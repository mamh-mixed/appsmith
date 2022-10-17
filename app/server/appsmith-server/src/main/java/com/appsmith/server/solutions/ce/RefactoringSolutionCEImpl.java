package com.appsmith.server.solutions.ce;

import com.appsmith.external.models.ActionConfiguration;
import com.appsmith.external.models.ActionDTO;
import com.appsmith.server.configurations.InstanceConfig;
import com.appsmith.server.constants.FieldName;
import com.appsmith.server.domains.Layout;
import com.appsmith.server.domains.NewAction;
import com.appsmith.server.dtos.ActionCollectionDTO;
import com.appsmith.server.dtos.LayoutDTO;
import com.appsmith.server.dtos.PageDTO;
import com.appsmith.server.dtos.RefactorActionNameDTO;
import com.appsmith.server.dtos.RefactorNameDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.helpers.DslUtils;
import com.appsmith.server.helpers.ResponseUtils;
import com.appsmith.server.services.ActionCollectionService;
import com.appsmith.server.services.ApplicationService;
import com.appsmith.server.services.AstService;
import com.appsmith.server.services.LayoutActionService;
import com.appsmith.server.services.NewActionService;
import com.appsmith.server.services.NewPageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import lombok.extern.slf4j.Slf4j;
import net.minidev.json.JSONObject;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.function.Tuple2;

import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.StreamSupport;

import static com.appsmith.server.acl.AclPermission.MANAGE_ACTIONS;
import static com.appsmith.server.acl.AclPermission.MANAGE_PAGES;
import static com.appsmith.server.services.ce.ApplicationPageServiceCEImpl.EVALUATION_VERSION;
import static java.util.stream.Collectors.toSet;

@Slf4j
public class RefactoringSolutionCEImpl implements RefactoringSolutionCE {

    private final ObjectMapper objectMapper;
    private final NewPageService newPageService;
    private final NewActionService newActionService;
    private final ActionCollectionService actionCollectionService;
    private final ResponseUtils responseUtils;
    private final LayoutActionService layoutActionService;
    private final ApplicationService applicationService;
    private final AstService astService;
    private final InstanceConfig instanceConfig;
    private final Boolean isRtsAccessible;

    /*
     * To replace fetchUsers in `{{JSON.stringify(fetchUsers)}}` with getUsers, the following regex is required :
     * `\\b(fetchUsers)\\b`. To achieve this the following strings preWord and postWord are declared here to be used
     * at run time to create the regex pattern.
     */
    private final String preWord = "\\b(";
    private final String postWord = ")\\b";

    public RefactoringSolutionCEImpl(ObjectMapper objectMapper,
                                     NewPageService newPageService,
                                     NewActionService newActionService,
                                     ActionCollectionService actionCollectionService,
                                     ResponseUtils responseUtils,
                                     LayoutActionService layoutActionService,
                                     ApplicationService applicationService,
                                     AstService astService,
                                     InstanceConfig instanceConfig) {
        this.objectMapper = objectMapper;
        this.newPageService = newPageService;
        this.newActionService = newActionService;
        this.actionCollectionService = actionCollectionService;
        this.responseUtils = responseUtils;
        this.layoutActionService = layoutActionService;
        this.applicationService = applicationService;
        this.astService = astService;
        this.instanceConfig = instanceConfig;

        // TODO Remove this variable and access the field directly when RTS API is ready
        this.isRtsAccessible = false;

    }

    @Override
    public Mono<LayoutDTO> refactorWidgetName(RefactorNameDTO refactorNameDTO) {
        String pageId = refactorNameDTO.getPageId();
        String layoutId = refactorNameDTO.getLayoutId();
        String oldName = refactorNameDTO.getOldName();
        String newName = refactorNameDTO.getNewName();
        return layoutActionService.isNameAllowed(pageId, layoutId, newName)
                .flatMap(allowed -> {
                    if (!allowed) {
                        return Mono.error(new AppsmithException(AppsmithError.NAME_CLASH_NOT_ALLOWED_IN_REFACTOR, oldName, newName));
                    }
                    return this.refactorName(pageId, layoutId, oldName, newName);
                });
    }

    @Override
    public Mono<LayoutDTO> refactorWidgetName(RefactorNameDTO refactorNameDTO, String branchName) {
        if (StringUtils.isEmpty(branchName)) {
            return refactorWidgetName(refactorNameDTO);
        }

        return newPageService.findByBranchNameAndDefaultPageId(branchName, refactorNameDTO.getPageId(), MANAGE_PAGES)
                .flatMap(branchedPage -> {
                    refactorNameDTO.setPageId(branchedPage.getId());
                    return refactorWidgetName(refactorNameDTO);
                })
                .map(responseUtils::updateLayoutDTOWithDefaultResources);
    }

    @Override
    public Mono<LayoutDTO> refactorActionName(RefactorActionNameDTO refactorActionNameDTO) {
        String pageId = refactorActionNameDTO.getPageId();
        String layoutId = refactorActionNameDTO.getLayoutId();
        String oldName = refactorActionNameDTO.getOldName();
        final String oldFullyQualifiedName = StringUtils.isEmpty(refactorActionNameDTO.getCollectionName()) ?
                oldName :
                refactorActionNameDTO.getCollectionName() + "." + oldName;
        String newName = refactorActionNameDTO.getNewName();
        final String newFullyQualifiedName = StringUtils.isEmpty(refactorActionNameDTO.getCollectionName()) ?
                newName :
                refactorActionNameDTO.getCollectionName() + "." + newName;
        String actionId = refactorActionNameDTO.getActionId();
        return Mono.just(newActionService.validateActionName(newName))
                .flatMap(isValidName -> {
                    if (!isValidName) {
                        return Mono.error(new AppsmithException(AppsmithError.INVALID_ACTION_NAME));
                    }
                    return layoutActionService.isNameAllowed(pageId, layoutId, newFullyQualifiedName);
                })
                .flatMap(allowed -> {
                    if (!allowed) {
                        return Mono.error(new AppsmithException(AppsmithError.NAME_CLASH_NOT_ALLOWED_IN_REFACTOR, oldName, newName));
                    }
                    return newActionService
                            .findActionDTObyIdAndViewMode(actionId, false, MANAGE_ACTIONS);
                })
                .flatMap(action -> {
                    action.setName(newName);
                    if (!StringUtils.isEmpty(refactorActionNameDTO.getCollectionName())) {
                        action.setFullyQualifiedName(newFullyQualifiedName);
                    }
                    return newActionService.updateUnpublishedAction(actionId, action);
                })
                .then(this.refactorName(pageId, layoutId, oldFullyQualifiedName, newFullyQualifiedName));
    }

    @Override
    public Mono<LayoutDTO> refactorActionName(RefactorActionNameDTO refactorActionNameDTO, String branchName) {

        String defaultActionId = refactorActionNameDTO.getActionId();
        return newActionService.findByBranchNameAndDefaultActionId(branchName, defaultActionId, MANAGE_ACTIONS)
                .flatMap(branchedAction -> {
                    refactorActionNameDTO.setActionId(branchedAction.getId());
                    refactorActionNameDTO.setPageId(branchedAction.getUnpublishedAction().getPageId());
                    return refactorActionName(refactorActionNameDTO);
                })
                .map(responseUtils::updateLayoutDTOWithDefaultResources);
    }

    /**
     * Assumption here is that the refactoring name provided is indeed unique and is fit to be replaced everywhere.
     * <p>
     * At this point, the user must have MANAGE_PAGES and MANAGE_ACTIONS permissions for page and action respectively
     *
     * @param pageId
     * @param layoutId
     * @param oldName
     * @param newName
     * @return
     */
    @Override
    public Mono<LayoutDTO> refactorName(String pageId, String layoutId, String oldName, String newName) {
        String regexPattern = preWord + oldName + postWord;
        Pattern oldNamePattern = Pattern.compile(regexPattern);

        Mono<PageDTO> pageMono = newPageService
                // fetch the unpublished page
                .findPageById(pageId, MANAGE_PAGES, false)
                .cache();

        Mono<Integer> evalVersionMono = pageMono
                .flatMap(page -> {
                    return applicationService.findById(page.getApplicationId())
                            .map(application -> {
                                Integer evaluationVersion = application.getEvaluationVersion();
                                if (evaluationVersion == null) {
                                    evaluationVersion = EVALUATION_VERSION;
                                }
                                return evaluationVersion;
                            });
                })
                .cache();

        Mono<PageDTO> updatePageMono = Mono.zip(pageMono, evalVersionMono)
                .flatMap(tuple -> {
                    PageDTO page = tuple.getT1();
                    int evalVersion = tuple.getT2();

                    List<Layout> layouts = page.getLayouts();
                    for (Layout layout : layouts) {
                        if (layoutId.equals(layout.getId()) && layout.getDsl() != null) {
                            // DSL has removed all the old names and replaced it with new name. If the change of name
                            // was one of the mongoEscaped widgets, then update the names in the set as well
                            Set<String> mongoEscapedWidgetNames = layout.getMongoEscapedWidgetNames();
                            if (mongoEscapedWidgetNames != null && mongoEscapedWidgetNames.contains(oldName)) {
                                mongoEscapedWidgetNames.remove(oldName);
                                mongoEscapedWidgetNames.add(newName);
                            }

                            final JsonNode dslNode = objectMapper.convertValue(layout.getDsl(), JsonNode.class);
                            Mono<PageDTO> refactorNameInDslMono = this.refactorNameInDsl(dslNode, oldName, newName, evalVersion, oldNamePattern)
                                    .then(Mono.fromCallable(() -> {
                                        layout.setDsl(objectMapper.convertValue(dslNode, JSONObject.class));
                                        page.setLayouts(layouts);
                                        return page;
                                    }));

                            // Since the page has most probably changed, save the page and return.
                            return refactorNameInDslMono
                                    .flatMap(newPageService::saveUnpublishedPage);
                        }
                    }
                    // If we have reached here, the layout was not found and the page should be returned as is.
                    return Mono.just(page);
                });

        Set<String> updatableCollectionIds = new HashSet<>();

        Mono<Set<String>> updateActionsMono = newActionService
                .findByPageIdAndViewMode(pageId, false, MANAGE_ACTIONS)
                /*
                 * Assuming that the datasource should not be dependent on the widget and hence not going through the same
                 * to look for replacement pattern.
                 */
                .flatMap(newAction1 -> {
                    final NewAction newAction = newAction1;
                    // We need actionDTO to be populated with pluginType from NewAction
                    // so that we can check for the JS path
                    Mono<ActionDTO> actionMono = newActionService.generateActionByViewMode(newAction, false);
                    return actionMono.flatMap(action -> {
                        newAction.setUnpublishedAction(action);
                        boolean actionUpdateRequired = false;
                        ActionConfiguration actionConfiguration = action.getActionConfiguration();
                        Set<String> jsonPathKeys = action.getJsonPathKeys();

                        if (jsonPathKeys != null && !jsonPathKeys.isEmpty()) {
                            // Since json path keys actually contain the entire inline js function instead of just the widget/action
                            // name, we can not simply use the set.contains(obj) function. We need to iterate over all the keys
                            // in the set and see if the old name is a substring of the json path key.
                            for (String key : jsonPathKeys) {
                                if (oldNamePattern.matcher(key).find()) {
                                    actionUpdateRequired = true;
                                    break;
                                }
                            }
                        }

                        if (!actionUpdateRequired || actionConfiguration == null) {
                            return Mono.just(newAction);
                        }
                        // if actionUpdateRequired is true AND actionConfiguration is not null
                        if (action.getCollectionId() != null) {
                            updatableCollectionIds.add(action.getCollectionId());
                        }
                        final JsonNode actionConfigurationNode = objectMapper.convertValue(actionConfiguration, JsonNode.class);
                        final JsonNode actionConfigurationNodeAfterReplacement = replaceStringInJsonNode(actionConfigurationNode, oldNamePattern, newName);

                        ActionConfiguration newActionConfiguration = objectMapper.convertValue(actionConfigurationNodeAfterReplacement, ActionConfiguration.class);
                        action.setActionConfiguration(newActionConfiguration);
                        NewAction newAction2 = newActionService.extractAndSetJsonPathKeys(newAction);
                        return newActionService.save(newAction2);
                    });

                })
                .map(savedAction -> savedAction.getUnpublishedAction().getName())
                .collect(toSet())
                .flatMap(updatedActions -> {
                    // If these actions belonged to collections, update the collection body
                    return Flux.fromIterable(updatableCollectionIds)
                            .flatMap(collectionId -> actionCollectionService.findById(collectionId, MANAGE_ACTIONS))
                            .flatMap(actionCollection -> {
                                final ActionCollectionDTO unpublishedCollection = actionCollection.getUnpublishedCollection();
                                Matcher matcher = oldNamePattern.matcher(unpublishedCollection.getBody());
                                String newBodyAsString = matcher.replaceAll(newName);
                                unpublishedCollection.setBody(newBodyAsString);
                                return actionCollectionService.save(actionCollection);
                            })
                            .collectList()
                            .thenReturn(updatedActions);
                });

        return Mono.zip(updateActionsMono, updatePageMono)
                .flatMap(tuple -> {
                    Set<String> updatedActionNames = tuple.getT1();
                    PageDTO page = tuple.getT2();
                    log.debug("Actions updated due to refactor name in page {} are : {}", pageId, updatedActionNames);
                    List<Layout> layouts = page.getLayouts();
                    for (Layout layout : layouts) {
                        if (layoutId.equals(layout.getId())) {
                            layout.setDsl(layoutActionService.unescapeMongoSpecialCharacters(layout));
                            return layoutActionService.updateLayout(page.getId(), page.getApplicationId(), layout.getId(), layout);
                        }
                    }
                    return Mono.empty();
                });
    }


    private JsonNode replaceStringInJsonNode(JsonNode jsonNode, Pattern oldNamePattern, String newName) {
        // If this is a text node, perform replacement directly
        if (jsonNode.isTextual()) {
            Matcher matcher = oldNamePattern.matcher(jsonNode.asText());
            String valueAfterReplacement = matcher.replaceAll(newName);
            return new TextNode(valueAfterReplacement);
        }

        // TODO This is special handling for the list widget that has been added to allow refactoring of
        //  just the default widgets inside the list. This is required because for the list, the widget names
        //  exist as keys at the location List1.template(.Text1) [Ref #9281]
        //  Ideally, we should avoid any non-structural elements as keys. This will be improved in list widget v2
        if (jsonNode.has("type") && "LIST_WIDGET".equals(jsonNode.get("type").asText())) {
            final JsonNode template = jsonNode.get("template");
            JsonNode newJsonNode = null;
            String fieldName = null;
            final Iterator<String> templateIterator = template.fieldNames();
            while (templateIterator.hasNext()) {
                fieldName = templateIterator.next();

                // For each element within template, check whether it would match the replacement pattern
                final Matcher listWidgetTemplateKeyMatcher = oldNamePattern.matcher(fieldName);
                if (listWidgetTemplateKeyMatcher.find()) {
                    newJsonNode = template.get(fieldName);
                    break;
                }
            }
            if (newJsonNode != null) {
                // If such a pattern is found, remove that element and attach it back with the new name
                ((ObjectNode) template).remove(fieldName);
                ((ObjectNode) template).set(newName, newJsonNode);
            }
        }

        final Iterator<Map.Entry<String, JsonNode>> iterator = jsonNode.fields();
        // Go through each field to recursively operate on it
        while (iterator.hasNext()) {
            final Map.Entry<String, JsonNode> next = iterator.next();
            final JsonNode value = next.getValue();
            if (value.isArray()) {
                // If this field is an array type, iterate through each element and perform replacement
                final ArrayNode arrayNode = (ArrayNode) value;
                final ArrayNode newArrayNode = objectMapper.createArrayNode();
                arrayNode.forEach(x -> newArrayNode.add(replaceStringInJsonNode(x, oldNamePattern, newName)));
                // Make this array node created from replaced values the new value
                next.setValue(newArrayNode);
            } else {
                // This is either directly a text node or another json node
                // In either case, recurse over the entire value to get the replaced value
                next.setValue(replaceStringInJsonNode(value, oldNamePattern, newName));
            }
        }
        return jsonNode;
    }

    Mono<Void> refactorNameInDsl(JsonNode dsl, String oldName, String newName, int evalVersion, Pattern oldNamePattern) {

        Mono<Void> refactorNameInWidgetMono = Mono.empty().then();
        Mono<List<Void>> recursiveRefactorNameInDslMono = Mono.empty();

        // if current object is widget,
        if (dsl.has(FieldName.WIDGET_ID)) {
            // enter parse widget method
            refactorNameInWidgetMono = refactorNameInWidget(dsl, oldName, newName, evalVersion, oldNamePattern);
        }
        // if current object has children,
        if (dsl.has("children")) {
            ArrayNode dslChildren = (ArrayNode) dsl.get("children");
            // recurse over each child
            recursiveRefactorNameInDslMono = Flux.fromStream(StreamSupport.stream(dslChildren.spliterator(), true))
                    .flatMap(child -> refactorNameInDsl(child, oldName, newName, evalVersion, oldNamePattern))
                    .collectList();
        }

        return refactorNameInWidgetMono
                .then(recursiveRefactorNameInDslMono)
                .then();
    }

    Mono<Void> refactorNameInWidget(JsonNode widgetDsl, String oldName, String newName, int evalVersion, Pattern oldNamePattern) {

        Mono<Void> refactorDynamicBindingsMono = Mono.empty().then();

        // If the name of this widget matches the old name, replace the name
        if (widgetDsl.has(FieldName.WIDGET_NAME) && oldName.equals(widgetDsl.get(FieldName.WIDGET_NAME).asText())) {
            ((ObjectNode) widgetDsl).set(FieldName.WIDGET_NAME, new TextNode(newName));
        }

        // This is special handling for the list widget that has been added to allow refactoring of
        // just the default widgets inside the list. This is required because for the list, the widget names
        // exist as keys at the location List1.template(.Text1) [Ref #9281]
        // Ideally, we should avoid any non-structural elements as keys. This will be improved in list widget v2
        if (widgetDsl.has(FieldName.WIDGET_TYPE) && FieldName.LIST_WIDGET.equals(widgetDsl.get(FieldName.WIDGET_TYPE).asText())) {
            final JsonNode template = widgetDsl.get(FieldName.LIST_WIDGET_TEMPLATE);
            JsonNode newJsonNode = null;
            String fieldName = null;
            final Iterator<String> templateIterator = template.fieldNames();
            while (templateIterator.hasNext()) {
                fieldName = templateIterator.next();

                if (oldName.equals(fieldName)) {
                    newJsonNode = template.get(fieldName);
                    break;
                }
            }
            if (newJsonNode != null) {
                // If such a pattern is found, remove that element and attach it back with the new name
                ((ObjectNode) template).remove(fieldName);
                ((ObjectNode) template).set(newName, newJsonNode);
            }
        }

        // If there are dynamic bindings in this widget, inspect them
        if (widgetDsl.has(FieldName.DYNAMIC_BINDING_PATH_LIST) && !widgetDsl.get(FieldName.DYNAMIC_BINDING_PATH_LIST).isEmpty()) {
            ArrayNode dslDynamicBindingPathList = (ArrayNode) widgetDsl.get(FieldName.DYNAMIC_BINDING_PATH_LIST);
            // recurse over each child
            refactorDynamicBindingsMono = Flux.fromStream(StreamSupport.stream(dslDynamicBindingPathList.spliterator(), true))
                    .flatMap(dynamicBindingPath -> {
                        String key = dynamicBindingPath.get(FieldName.KEY).asText();
                        Set<String> mustacheValues = DslUtils.getMustacheValueSetFromSpecificDynamicBindingPath(widgetDsl, key);
                        return this.replaceValueInMustacheKeys(mustacheValues, oldName, newName, evalVersion, oldNamePattern)
                                .map(replacementMap -> {
                                    return DslUtils.replaceValuesInSpecificDynamicBindingPath(widgetDsl, key, replacementMap);
                                });
                    })
                    .collectList()
                    .then();
        }

        return refactorDynamicBindingsMono;
    }

    Mono<Map<String, String>> replaceValueInMustacheKeys(Set<String> mustacheKeySet, String oldName, String newName, int evalVersion, Pattern oldNamePattern) {
        if (Boolean.TRUE.equals(this.isRtsAccessible)) {
            return astService.refactorNameInDynamicBindings(mustacheKeySet, oldName, newName, evalVersion);
        }
        return this.replaceValueInMustacheKeys(mustacheKeySet, oldNamePattern, newName);
    }

    Mono<Map<String, String>> replaceValueInMustacheKeys(Set<String> mustacheKeySet, Pattern oldNamePattern, String newName) {
        return Flux.fromIterable(mustacheKeySet)
                .flatMap(mustacheKey -> {
                    Matcher matcher = oldNamePattern.matcher(mustacheKey);
                    if (matcher.find()) {
                        return Mono.zip(Mono.just(mustacheKey), Mono.just(matcher.replaceAll(newName)));
                    }
                    return Mono.empty();
                })
                .collectMap(Tuple2::getT1, Tuple2::getT2);
    }
}
