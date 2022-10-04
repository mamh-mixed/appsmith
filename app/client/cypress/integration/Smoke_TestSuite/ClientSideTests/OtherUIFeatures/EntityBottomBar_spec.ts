import { ObjectsRegistry } from "../../../../support/Objects/Registry";

const {
  ApiPage: apiPage,
  DataSources: dataSources,
  Debugger: debuggerHelper,
  JSEditor: jsEditor,
} = ObjectsRegistry;

describe("Debugger bottom bar", () => {
  it("should be closable", () => {
    debuggerHelper.Open();
    debuggerHelper.isOpen();
    debuggerHelper.Close();
    debuggerHelper.isClosed();
  });
});

describe("Api bottom bar", () => {
  it("should be collapsable", () => {
    apiPage.CreateApi();
    apiPage.isBottomPaneOpen();

    apiPage.closeBottomPane();
    apiPage.isBottomPaneClosed();

    apiPage.openResponseTab();
    apiPage.isBottomPaneOpen();
  });
});

describe("JsEditor bottom bar", () => {
  it("should be collapsable", () => {
    jsEditor.NavigateToNewJSEditor();
    jsEditor.isBottomPaneOpen();

    jsEditor.closeBottomPane();
    jsEditor.isBottomPaneClosed();

    jsEditor.openResponseTab();
    jsEditor.isBottomPaneOpen();
  });
});

describe("Query bottom bar", () => {
  let mockDBName;
  it("should be collapsable", () => {
    dataSources.createMockDB("Users").then((dbName) => {
      mockDBName = dbName;
      dataSources.CreateQuery(mockDBName);
      dataSources.isBottomPaneOpen();

      dataSources.closeBottomPane();
      dataSources.isBottomPaneClosed();

      dataSources.openResponseTab();
      dataSources.isBottomPaneOpen();

      // clean up
      dataSources.DeleteQuery("Query1");
      dataSources.DeleteDatasouceFromActiveTab(mockDBName);
    });
  });
});
