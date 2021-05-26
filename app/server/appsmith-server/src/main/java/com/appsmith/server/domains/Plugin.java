package com.appsmith.server.domains;

import com.appsmith.external.constants.DisplayDataType;
import com.appsmith.external.models.AuthenticationDTO;
import com.appsmith.external.models.BaseDomain;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import net.minidev.json.annotate.JsonIgnore;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@ToString
@NoArgsConstructor
@Document
public class Plugin extends BaseDomain {

    String name;

    PluginType type;

    // This reference determines the pf4j module to be used for plugin execution, etc
    String packageName;

    // The plugin name is a unique identifier for each type of integration as seen by the user
    String pluginName;

    // Each plugin may have configurations that
    String pluginSpecificationId;

    String jarLocation;

    String iconLocation;

    String documentationLink;

    DisplayDataType responseType;

    List<PluginParameterType> datasourceParams;

    List<PluginParameterType> actionParams;

    String minAppsmithVersionSupported;

    String maxAppsmithVersionSupported;

    String version;

    // Legacy field to find which form to use (RapidAPI hack)
    String uiComponent;

    // Static metadata to indicate what type of form to use in the datasource creation page
    String datasourceComponent;

    // Static metadata to indicate what type of form to use in the action creation page
    String actionComponent;

    // Marking it as JsonIgnore because we don't want other users to be able to set this property. Only admins
    // must be able to mark a plugin for defaultInstall on all organization creations
    @JsonIgnore
    Boolean defaultInstall;

    Boolean allowUserDatasources = true;

    @Transient
    Map<String, String> templates;

    // Entry: <MethodName, TemplateId>
    private Map<String, String> actionTemplateIds;

    // A particular plugin can be capable of supporting multiple authentication mechanisms
    // For each of the mechanisms, we store the datasource form template separately
    private Map<Class<? extends AuthenticationDTO>, String> datasourceTemplateIds;

    // Plugins can be divided into categories depending on their business use case
    // A single plugin can belong to multiple categories
    List<String> categories;

    // credentialSteps - should be covered by authenticationDTO
    // documentation - one liner separate from appsmith documentation?
    // statistics - as an enhancement
}