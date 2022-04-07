import {
  ValidationResponse,
  ValidationTypes,
} from "constants/WidgetValidation";
import { EvaluationSubstitutionType } from "entities/DataTree/dataTreeFactory";
import { get } from "lodash";
import { AutocompleteDataType } from "utils/autocomplete/TernServer";
import {
  ARRAY_ITEM_KEY,
  FIELD_EXPECTING_OPTIONS,
  FIELD_SUPPORTING_FOCUS_EVENTS,
  FieldType,
  SchemaItem,
} from "widgets/JSONFormWidget/constants";
import { JSONFormWidgetProps } from "../..";
import { getParentPropertyPath } from "../../helper";
import {
  fieldTypeUpdateHook,
  getSchemaItem,
  getStylesheetValue,
  HiddenFnParams,
  hiddenIfArrayItemIsObject,
  updateChildrenDisabledStateHook,
} from "../helper";

// ARRAY and OBJECT have border radius but in their own property configs as they have a variation
const FIELDS_WITHOUT_BORDER_RADIUS = [
  FieldType.ARRAY,
  FieldType.OBJECT,
  FieldType.RADIO_GROUP,
  FieldType.SWITCH,
];

const FIELDS_WITHOUT_BOX_SHADOW = [
  FieldType.ARRAY,
  FieldType.OBJECT,
  FieldType.CHECKBOX,
  FieldType.RADIO_GROUP,
  FieldType.SWITCH,
];

function accessorValidation(
  value: any,
  props: JSONFormWidgetProps,
  lodash: any,
  _: any,
  propertyPath: string,
): ValidationResponse {
  const propertyPathChunks = propertyPath.split(".");
  const grandParentPath = propertyPathChunks.slice(0, -2).join(".");
  const schemaItemIdentifier = propertyPathChunks.slice(-2)[0]; // ['schema', '__root_field__', 'children', 'age', 'name'] -> age
  const schema = lodash.cloneDeep(lodash.get(props, grandParentPath));
  const RESTRICTED_KEYS = ["__array_item__", "__root_schema__"];
  const currentSchemaItem = lodash.cloneDeep(schema[schemaItemIdentifier]);
  // Remove the current edited schemaItem from schema so it doesn't
  // get picked in the existing keys list
  delete schema[schemaItemIdentifier];

  // If the field is not _id (mongo id) then it shouldn't be allowed
  if (currentSchemaItem.originalIdentifier !== "_id") {
    RESTRICTED_KEYS.push("_id");
  }

  if (value === "") {
    return {
      isValid: false,
      parsed: value,
      messages: ["Property Name cannot be empty"],
    };
  }

  const existingKeys = (Object.values(schema) || []).map(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (schemaItem) => schemaItem.name,
  );

  if (existingKeys.includes(value)) {
    return {
      isValid: false,
      parsed: "",
      messages: ["Property name already in use."],
    };
  }

  if (RESTRICTED_KEYS.includes(value)) {
    return {
      isValid: false,
      parsed: "",
      messages: ["This is a restricted Property Name"],
    };
  }

  return {
    isValid: true,
    parsed: value,
    messages: [""],
  };
}

const COMMON_PROPERTIES = {
  fieldType: [
    {
      propertyName: "fieldType",
      label: "Field Type",
      controlType: "DROP_DOWN",
      isBindProperty: false,
      isTriggerProperty: false,
      options: Object.values(FieldType).map((option) => ({
        label: option,
        value: option,
      })),
      dependencies: ["schema", "childStylesheets", "dynamicBindingPathList"],
      updateHook: fieldTypeUpdateHook,
    },
  ],
  options: [
    {
      propertyName: "options",
      helpText:
        "Allows users to select from the given option(s). Values must be unique",
      label: "Options",
      controlType: "INPUT_TEXT",
      placeholderText: '[{ "label": "Option1", "value": "Option2" }]',
      isBindProperty: true,
      isTriggerProperty: false,
      validation: {
        type: ValidationTypes.ARRAY,
        params: {
          unique: ["value"],
          children: {
            type: ValidationTypes.OBJECT,
            params: {
              required: true,
              allowedKeys: [
                {
                  name: "label",
                  type: ValidationTypes.TEXT,
                  params: {
                    default: "",
                    required: true,
                  },
                },
                {
                  name: "value",
                  type: ValidationTypes.TEXT,
                  params: {
                    default: "",
                    required: true,
                  },
                },
              ],
            },
          },
        },
      },
      evaluationSubstitutionType: EvaluationSubstitutionType.SMART_SUBSTITUTE,
      hidden: (...args: HiddenFnParams) =>
        getSchemaItem(...args).fieldTypeNotIncludes(FIELD_EXPECTING_OPTIONS),
      dependencies: ["schema", "sourceData"],
    },
  ],
  customField: [
    {
      propertyName: "accessor",
      helpText:
        "Sets the property name of the field which can be used to access the value in formData and fieldState.",
      label: "Property Name",
      controlType: "INPUT_TEXT",
      placeholderText: "name",
      isBindProperty: true,
      isTriggerProperty: false,
      validation: {
        type: ValidationTypes.FUNCTION,
        params: {
          fn: accessorValidation,
          expected: {
            type: "unique string",
            example: `firstName | last_name | age14`,
            autocompleteDataType: AutocompleteDataType.STRING,
          },
        },
      },
      hidden: (props: JSONFormWidgetProps, propertyPath: string) => {
        const parentPath = getParentPropertyPath(propertyPath);
        const schemaItem: SchemaItem = get(props, parentPath, {});
        const isArrayItem = schemaItem.identifier === ARRAY_ITEM_KEY;

        if (isArrayItem) return true;
      },
      dependencies: ["schema"],
    },
  ],
  accessibility: [
    {
      propertyName: "label",
      helpText: "Sets the label text of the field",
      label: "Label",
      controlType: "INPUT_TEXT",
      placeholderText: "Name:",
      isBindProperty: true,
      isTriggerProperty: false,
      validation: { type: ValidationTypes.TEXT },
      hidden: hiddenIfArrayItemIsObject,
      dependencies: ["schema", "sourceData"],
    },
    {
      label: "Required",
      propertyName: "isRequired",
      helpText: "Makes input to the widget mandatory",
      controlType: "SWITCH",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      validation: { type: ValidationTypes.BOOLEAN },
      hidden: (...args: HiddenFnParams) => {
        return getSchemaItem(...args).compute(
          (schemaItem) =>
            schemaItem.fieldType === FieldType.OBJECT ||
            schemaItem.fieldType === FieldType.ARRAY,
        );
      },
      dependencies: ["schema", "sourceData"],
    },
    {
      propertyName: "isVisible",
      helpText: "Controls the visibility of the field",
      label: "Visible",
      controlType: "SWITCH",
      defaultValue: true,
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      validation: { type: ValidationTypes.BOOLEAN },
      hidden: (...args: HiddenFnParams) => {
        return getSchemaItem(...args).compute(
          (schemaItem) => schemaItem.identifier === ARRAY_ITEM_KEY,
        );
      },
      dependencies: ["schema", "sourceData"],
    },
    {
      propertyName: "isDisabled",
      helpText: "Disables the field",
      label: "Disabled",
      controlType: "SWITCH",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      validation: { type: ValidationTypes.BOOLEAN },
      dependencies: ["schema", "sourceData"],
      updateHook: updateChildrenDisabledStateHook,
    },
    {
      propertyName: "tooltip",
      helpText: "Show help text or details about current field",
      label: "Tooltip",
      controlType: "JSON_FORM_COMPUTE_VALUE",
      placeholderText: "Passwords must be at-least 6 chars",
      isBindProperty: true,
      isTriggerProperty: false,
      validation: { type: ValidationTypes.TEXT },
      hidden: hiddenIfArrayItemIsObject,
      dependencies: ["schema", "sourceData"],
    },
  ],
  labelStyles: [
    {
      propertyName: "labelTextColor",
      label: "Text Color",
      controlType: "COLOR_PICKER",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      validation: {
        type: ValidationTypes.TEXT,
        params: {
          regex: /^(?![<|{{]).+/,
        },
      },
      dependencies: ["schema", "sourceData"],
    },
    {
      propertyName: "labelTextSize",
      label: "Text Size",
      controlType: "DROP_DOWN",
      options: [
        {
          label: "sm",
          value: "0.875rem",
          subText: "0.875rem",
        },
        {
          label: "base",
          value: "1rem",
          subText: "1rem",
        },
        {
          label: "lg",
          value: "1.25rem",
          subText: "1.25rem",
        },
        {
          label: "xl",
          value: "1.875rem",
          subText: "1.875rem",
        },
        {
          label: "2xl",
          value: "3rem",
          subText: "3rem",
        },
        {
          label: "3xl",
          value: "3.75rem",
          subText: "3.75rem",
        },
      ],
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      validation: { type: ValidationTypes.TEXT },
    },
    {
      propertyName: "labelStyle",
      label: "Label Font Style",
      controlType: "BUTTON_TABS",
      options: [
        {
          icon: "BOLD_FONT",
          value: "BOLD",
        },
        {
          icon: "ITALICS_FONT",
          value: "ITALIC",
        },
      ],
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      validation: { type: ValidationTypes.TEXT },
      dependencies: ["schema", "sourceData"],
    },
  ],
  actions: [
    {
      propertyName: "onFocus",
      helpText: "Triggers an action when focused.",
      label: "onFocus",
      controlType: "ACTION_SELECTOR",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: true,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      dependencies: ["schema", "sourceData"],
      hidden: (...args: HiddenFnParams) =>
        getSchemaItem(...args).fieldTypeNotIncludes(
          FIELD_SUPPORTING_FOCUS_EVENTS,
        ),
    },
    {
      propertyName: "onBlur",
      helpText: "Triggers an action when the field loses focus.",
      label: "onBlur",
      controlType: "ACTION_SELECTOR",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: true,
      customJSControl: "JSON_FORM_COMPUTE_VALUE",
      dependencies: ["schema", "sourceData"],
      hidden: (...args: HiddenFnParams) =>
        getSchemaItem(...args).fieldTypeNotIncludes(
          FIELD_SUPPORTING_FOCUS_EVENTS,
        ),
    },
  ],
  styles: [
    {
      propertyName: "borderRadius",
      label: "Border Radius",
      helpText: "Rounds the corners of the icon button's outer border edge",
      controlType: "BORDER_RADIUS_OPTIONS",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      validation: { type: ValidationTypes.TEXT },
      getStylesheetValue,
      hidden: (...args: HiddenFnParams) =>
        getSchemaItem(...args).fieldTypeIncludes(FIELDS_WITHOUT_BORDER_RADIUS),
      dependencies: ["schema"],
    },
    {
      propertyName: "boxShadow",
      label: "Box Shadow",
      helpText:
        "Enables you to cast a drop shadow from the frame of the widget",
      controlType: "BOX_SHADOW_OPTIONS",
      isJSConvertible: true,
      isBindProperty: true,
      isTriggerProperty: false,
      getStylesheetValue,
      hidden: (...args: HiddenFnParams) =>
        getSchemaItem(...args).fieldTypeIncludes(FIELDS_WITHOUT_BOX_SHADOW),
      validation: { type: ValidationTypes.TEXT },
      dependencies: ["schema"],
    },
  ],
};

export default COMMON_PROPERTIES;
