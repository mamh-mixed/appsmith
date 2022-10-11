import { ObjectsRegistry } from "../../../../support/Objects/Registry";
const jsEditor = ObjectsRegistry.JSEditor;
const agHelper = ObjectsRegistry.AggregateHelper;

describe("Tests setTimeout API", function() {
  it("Executes showAlert after 3 seconds and uses default value", () => {
    jsEditor.CreateJSObject(
      `export default {
        myVar1: [],
        myVar2: {},
        myFun1: (x = "default") => {
            setTimeout(() => {
                showAlert("Hello world - " + x);
            }, 3000);
        }
    }`,
      {
        paste: true,
        completeReplace: true,
        toRun: false,
        shouldCreateNewJSObj: true,
        prettify: true,
      },
    );
    agHelper.Sleep(2000);
    jsEditor.RunJSObj();
    agHelper.Sleep(3000);
    agHelper.AssertContains("Hello world - default", "exist");
  });
  it("Executes all three alerts in parallel after 3 seconds", () => {
    jsEditor.CreateJSObject(
      `export default {
        myVar1: [],
        myVar2: {},
        myFun1: (x = "default") => {
            setTimeout(() => {
                showAlert("Hello world - " + x);
            }, 3000);
        },
        myFun2: () => {
            this.myFun1(1)
            this.myFun1(2)
            this.myFun1(3)
        }
    }`,
      {
        paste: true,
        completeReplace: true,
        toRun: false,
        shouldCreateNewJSObj: true,
        prettify: true,
      },
    );
    agHelper.Sleep(2000);
    jsEditor.SelectFunctionDropdown("myFun2");
    jsEditor.RunJSObj();
    agHelper.Sleep(3000);
    agHelper.AssertContains("Hello world - 1", "exist");
    agHelper.AssertContains("Hello world - 2", "exist");
    agHelper.AssertContains("Hello world - 3", "exist");
  });
  it("Resolves promise after 3 seconds and shows alert", () => {
    jsEditor.CreateJSObject(
      `export default {
        myVar1: [],
        myVar2: {},
        myFun1: (x) => {
            new Promise((res, rej) => setTimeout(() => res("resolved"), 3000)).then((res) => {
                showAlert(res);
            });
        },
    }`,
      {
        paste: true,
        completeReplace: true,
        toRun: false,
        shouldCreateNewJSObj: true,
        prettify: true,
      },
    );
    agHelper.Sleep(2000);
    jsEditor.RunJSObj();
    agHelper.Sleep(3000);
    agHelper.AssertContains("resolved");
  });
});