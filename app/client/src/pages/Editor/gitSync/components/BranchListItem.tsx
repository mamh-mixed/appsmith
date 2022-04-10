import React, { useEffect } from "react";
import scrollIntoView from "scroll-into-view-if-needed";
import { BranchListItemContainer } from "./BranchListItemContainer";
import Tooltip from "components/ads/Tooltip";
import { isEllipsisActive } from "utils/helpers";
import { Position } from "@blueprintjs/core";
import Text, { TextType } from "components/ads/Text";
import DefaultTag from "./DefaultTag";
import useHover from "../hooks/useHover";

export function BranchListItem({
  active,
  branch,
  className,
  isDefault,
  onClick,
  selected,
  shouldScrollIntoView,
}: any) {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [hover] = useHover(itemRef);
  useEffect(() => {
    if (itemRef.current && shouldScrollIntoView)
      scrollIntoView(itemRef.current, {
        scrollMode: "if-needed",
        block: "nearest",
        inline: "nearest",
      });
  }, [shouldScrollIntoView]);

  return (
    <BranchListItemContainer
      active={active}
      className={className}
      isDefault={isDefault}
      onClick={onClick}
      ref={itemRef}
      selected={selected}
    >
      <Tooltip
        boundary="window"
        content={branch}
        disabled={!isEllipsisActive(textRef.current)}
        position={Position.TOP}
      >
        <Text ref={textRef} type={TextType.P1}>
          {branch}
        </Text>
      </Tooltip>
      {isDefault && <DefaultTag />}
      {hover && !isDefault && <>...</>}
    </BranchListItemContainer>
  );
}
