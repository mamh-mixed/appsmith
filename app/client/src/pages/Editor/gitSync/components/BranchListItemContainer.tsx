import styled from "styled-components";
import { getTypographyByKey } from "constants/DefaultTheme";
import { Colors } from "constants/Colors";
import { Classes } from "components/ads";

export const BranchListItemContainer = styled.div<{
  selected?: boolean;
  active?: boolean;
  isDefault?: boolean;
}>`
  padding: ${(props) =>
    `${props.theme.spaces[4]}px ${props.theme.spaces[5]}px`};
  ${(props) => getTypographyByKey(props, "p1")};
  cursor: pointer;

  &:hover {
    background-color: ${Colors.Gallery};
  }

  width: 100%;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background-color: ${(props) =>
    props.selected || props.active ? Colors.GREY_3 : ""};

  display: grid;
  grid-gap: 16px;
  grid-template-columns: 9fr 1fr;

  .${Classes.TEXT} {
    width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  }
`;
