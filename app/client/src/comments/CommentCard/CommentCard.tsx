import React from "react";
import Editor from "@draft-js-plugins/editor";
import {
  CompositeDecorator,
  convertFromRaw,
  DraftDecorator,
  EditorState,
  RawDraftContentState,
} from "draft-js";
import styled from "styled-components";
import ProfileImage from "pages/common/ProfileImage";
import { Comment } from "entities/Comments/CommentsInterfaces";
import { getTypographyByKey } from "constants/DefaultTheme";
import CommentContextMenu from "./CommentContextMenu";
import ResolveCommentButton from "comments/CommentCard/ResolveCommentButton";

import createMentionPlugin from "@draft-js-plugins/mention";
import { flattenDeep, noop } from "lodash";

const StyledContainer = styled.div`
  width: 100%;
  padding: ${(props) =>
    `${props.theme.spaces[5]}px ${props.theme.spaces[7]}px`};
  border-radius: 0;
`;

const Separator = styled.div`
  background-color: ${(props) =>
    props.theme.colors.comments.childCommentsIndent};
  height: 1px;
  width: calc(100% - ${(props) => props.theme.spaces[7] * 2}px);
  margin-left: ${(props) => props.theme.spaces[7]}px;
`;

// ${(props) => getTypographyByKey(props, "p1")};
// line-height: 24px;
// color: ${(props) => props.theme.colors.comments.commentBody};
// margin-top: ${(props) => props.theme.spaces[3]}px;

const CommentBodyContainer = styled.div`
  background-color: ${(props) => props.theme.colors.comments.commentBackground};
  border-radius: ${(props) => props.theme.spaces[3]}px;
  padding: ${(props) =>
    `${props.theme.spaces[4]}px ${props.theme.spaces[5]}px`};
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: ${(props) => props.theme.spaces[5]}px;
`;

const UserName = styled.span`
  ${(props) => getTypographyByKey(props, "h5")}
  color: ${(props) => props.theme.colors.comments.profileUserName};
  margin-left: ${(props) => props.theme.spaces[4]}px;
  display: flex;
  align-items: center;
`;

const HeaderSection = styled.div`
  display: flex;
  align-items: center;
`;

const mentionPlugin = createMentionPlugin();
const plugins = [mentionPlugin];
const decorators = flattenDeep(plugins.map((plugin) => plugin.decorators));
const decorator = new CompositeDecorator(
  decorators.filter((_decorator, index) => index !== 1) as DraftDecorator[],
);

const CommentCard = ({
  comment,
  isParentComment,
  toggleResolved,
  resolved,
}: {
  comment: Comment;
  isParentComment?: boolean;
  resolved?: boolean;
  toggleResolved?: () => void;
}) => {
  const { authorName, body } = comment;
  const contentState = convertFromRaw(body as RawDraftContentState);
  const editorState = EditorState.createWithContent(contentState, decorator);
  const contextMenuProps = {
    pinComment: noop,
    copyComment: noop,
    deleteComment: noop,
  };

  return (
    <>
      <StyledContainer data-cy={`t--comment-card-${comment.id}`}>
        <CommentHeader>
          <HeaderSection>
            <ProfileImage userName={authorName || ""} side={30} />
            <UserName>{authorName}</UserName>
          </HeaderSection>
          <HeaderSection>
            {isParentComment && toggleResolved && (
              <ResolveCommentButton
                handleClick={toggleResolved}
                resolved={!!resolved}
              />
            )}
            <CommentContextMenu {...contextMenuProps} />
          </HeaderSection>
        </CommentHeader>
        <CommentBodyContainer>
          <Editor
            editorState={editorState}
            plugins={plugins}
            onChange={noop}
            readOnly
          />
        </CommentBodyContainer>
      </StyledContainer>
      {!isParentComment && <Separator />}
    </>
  );
};

export default CommentCard;
