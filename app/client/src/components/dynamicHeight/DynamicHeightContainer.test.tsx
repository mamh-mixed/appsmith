import React from "react";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import DynamicHeightContainer from "./DynamicHeightContainer";
import "jest-styled-components";
import renderer from "react-test-renderer";

describe("<DynamicHeightContainer />", () => {
  it("should wrap the children in a div whose height is auto", async () => {
    const tree = renderer
      .create(
        <DynamicHeightContainer
          maxDynamicHeight={0}
          isAutoHeightWithLimits={false}
          onHeightUpdate={() => {}}
        >
          <div data-testid="test" />
        </DynamicHeightContainer>,
      )
      .toJSON();
    expect(tree).toHaveStyleRule("height", "auto");
  });

  describe("when isAutoHeightWithLimits is false", () => {
    it("should wrap the children in a simple div with class auto-height-container", async () => {
      const getTestComponent = () => (
        <DynamicHeightContainer
          maxDynamicHeight={0}
          isAutoHeightWithLimits={false}
          onHeightUpdate={() => {}}
        >
          <div data-testid="test" />
        </DynamicHeightContainer>
      );
      const component = getTestComponent();
      const renderResult = render(component);
      const child = await renderResult.findByTestId("test");
      expect(
        child.parentElement?.classList.contains("auto-height-container"),
      ).toBe(true);
    });
  });

  describe("when isAutoHeightWithLimits is true", () => {
    it("should wrap the children in a div of class auto-height-container and then a div with class auto-height-scroll-container", async () => {
      const getTestComponent = () => (
        <DynamicHeightContainer
          maxDynamicHeight={0}
          isAutoHeightWithLimits={true}
          onHeightUpdate={() => {}}
        >
          <div data-testid="test" />
        </DynamicHeightContainer>
      );
      const component = getTestComponent();
      const renderResult = render(component);
      const child = await renderResult.findByTestId("test");
      expect(child.parentElement?.tagName).toBe("DIV");
      expect(
        child.parentElement?.classList.contains("auto-height-container"),
      ).toBe(true);
      expect(
        child.parentElement?.parentElement?.classList.contains(
          "auto-height-scroll-container",
        ),
      ).toBe(true);
    });
  });
});
