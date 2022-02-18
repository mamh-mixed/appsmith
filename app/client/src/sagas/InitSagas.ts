import { get } from "lodash";
import {
  all,
  call,
  put,
  race,
  select,
  take,
  takeLatest,
} from "redux-saga/effects";
import {
  CurrentApplicationData,
  Page,
  ReduxAction,
  ReduxActionErrorTypes,
  ReduxActionTypes,
  ReduxActionWithoutPayload,
} from "constants/ReduxActionConstants";
import { ERROR_CODES } from "@appsmith/constants/ApiConstants";

import {
  fetchPage,
  fetchPageList,
  fetchPublishedPage,
  setAppMode,
  updateAppPersistentStore,
} from "actions/pageActions";
import {
  fetchDatasources,
  fetchMockDatasources,
} from "actions/datasourceActions";
import { fetchPluginFormConfigs, fetchPlugins } from "actions/pluginActions";
import { fetchJSCollections } from "actions/jsActionActions";
import {
  executePageLoadActions,
  fetchActions,
  fetchActionsForView,
} from "actions/pluginActionActions";
import { fetchApplication } from "actions/applicationActions";
import AnalyticsUtil from "utils/AnalyticsUtil";
import { getCurrentApplication } from "selectors/applicationSelectors";
import { APP_MODE } from "entities/App";
import { getPersistentAppStore } from "constants/AppConstants";
import { getDefaultPageId } from "./selectors";
import { populatePageDSLsSaga } from "./PageSagas";
import log from "loglevel";
import * as Sentry from "@sentry/react";
import {
  resetRecentEntities,
  restoreRecentEntitiesRequest,
} from "actions/globalSearchActions";
import {
  InitializeEditorPayload,
  resetEditorSuccess,
} from "actions/initActions";
import PerformanceTracker, {
  PerformanceTransactionName,
} from "utils/PerformanceTracker";
import {
  getIsEditorInitialized,
  getPageById,
  selectURLSlugs,
} from "selectors/editorSelectors";
import { getIsInitialized as getIsViewerInitialized } from "selectors/appViewSelectors";
import { fetchCommentThreadsInit } from "actions/commentActions";
import { fetchJSCollectionsForView } from "actions/jsActionActions";
import {
  addBranchParam,
  getApplicationEditorPageURL,
  getApplicationViewerPageURL,
} from "constants/routes";
import history from "utils/history";
import {
  fetchGitStatusInit,
  remoteUrlInputValue,
  resetPullMergeStatus,
  updateBranchLocally,
} from "actions/gitSyncActions";
import { getCurrentGitBranch } from "selectors/gitSyncSelectors";
import PageApi, { FetchPageResponse } from "api/PageApi";
import {
  isPlaceholderPageId,
  isURLDeprecated,
  updateRoute,
} from "utils/helpers";

function* failFastApiCalls(
  triggerActions: Array<ReduxAction<unknown> | ReduxActionWithoutPayload>,
  successActions: string[],
  failureActions: string[],
) {
  const triggerEffects = [];
  for (const triggerAction of triggerActions) {
    triggerEffects.push(put(triggerAction));
  }
  const successEffects = [];
  for (const successAction of successActions) {
    successEffects.push(take(successAction));
  }
  yield all(triggerEffects);
  const effectRaceResult = yield race({
    success: all(successEffects),
    failure: take(failureActions),
  });
  if (effectRaceResult.failure) {
    yield put({
      type: ReduxActionTypes.SAFE_CRASH_APPSMITH_REQUEST,
      payload: {
        code: get(
          effectRaceResult,
          "failure.payload.error.code",
          ERROR_CODES.SERVER_ERROR,
        ),
      },
    });
    return false;
  }
  return true;
}

function* initializeEditorSaga(
  initializeEditorAction: ReduxAction<InitializeEditorPayload>,
) {
  yield put(resetEditorSuccess());

  // For old urls without pageId like /applications/:applicationId, we redirect users to /applicationId/page-:pageId
  // In such scenarios where we do not know pageId in advance,
  // we need to fallback on the applicationId which takes the place of :applicationSlug in the new route
  const { applicationSlug, branch, pageId } = initializeEditorAction.payload;

  // We set the applicationId as applicationSlug for urls which holds placeholder pageId in it.
  // We can trust to find a valid applicationId in the applicationSlug property here.
  let applicationId = isPlaceholderPageId(pageId) ? applicationSlug : "";

  try {
    // applicationId will be set only for old urls which do not have pageId in it.
    // We need the following api when we do not have applicationId info, which will be the case with all the new urls.
    if (!applicationId) {
      const currentPageInfo: FetchPageResponse = yield call(PageApi.fetchPage, {
        id: pageId as string,
      });
      applicationId = currentPageInfo.data.applicationId;
    }

    yield put(updateBranchLocally(branch || ""));

    PerformanceTracker.startAsyncTracking(
      PerformanceTransactionName.INIT_EDIT_APP,
    );
    yield put(setAppMode(APP_MODE.EDIT));
    yield put(
      updateAppPersistentStore(getPersistentAppStore(applicationId, branch)),
    );
    yield put({ type: ReduxActionTypes.START_EVALUATION });

    const initCalls = [
      fetchApplication({
        payload: {
          applicationId,
          mode: APP_MODE.EDIT,
        },
      }),
      fetchPageList({ applicationId }, APP_MODE.EDIT),
    ];

    const successEffects = [
      ReduxActionTypes.FETCH_APPLICATION_SUCCESS,
      ReduxActionTypes.FETCH_PAGE_LIST_SUCCESS,
    ];

    const failureEffects = [
      ReduxActionErrorTypes.FETCH_APPLICATION_ERROR,
      ReduxActionErrorTypes.FETCH_PAGE_LIST_ERROR,
    ];
    const jsActionsCall = yield failFastApiCalls(
      [fetchJSCollections({ applicationId })],
      [ReduxActionTypes.FETCH_JS_ACTIONS_SUCCESS],
      [ReduxActionErrorTypes.FETCH_JS_ACTIONS_ERROR],
    );
    if (!jsActionsCall) return;
    if (!isPlaceholderPageId(pageId)) {
      initCalls.push(fetchPage(pageId, true) as any);
      successEffects.push(ReduxActionTypes.FETCH_PAGE_SUCCESS);
      failureEffects.push(ReduxActionErrorTypes.FETCH_PAGE_ERROR);
    }

    const applicationAndLayoutCalls = yield failFastApiCalls(
      initCalls,
      successEffects,
      failureEffects,
    );

    if (!applicationAndLayoutCalls) return;

    let fetchPageCallResult;
    const defaultPageId: string = yield select(getDefaultPageId);
    const toLoadPageId: string = isPlaceholderPageId(pageId)
      ? defaultPageId
      : pageId;

    if (isPlaceholderPageId(pageId)) {
      if (!toLoadPageId) return;

      fetchPageCallResult = yield failFastApiCalls(
        [fetchPage(toLoadPageId, true)],
        [ReduxActionTypes.FETCH_PAGE_SUCCESS],
        [ReduxActionErrorTypes.FETCH_PAGE_ERROR],
      );
      if (!fetchPageCallResult) return;
    }

    const pluginsAndDatasourcesCalls = yield failFastApiCalls(
      [fetchPlugins(), fetchDatasources(), fetchMockDatasources()],
      [
        ReduxActionTypes.FETCH_PLUGINS_SUCCESS,
        ReduxActionTypes.FETCH_DATASOURCES_SUCCESS,
        ReduxActionTypes.FETCH_MOCK_DATASOURCES_SUCCESS,
      ],
      [
        ReduxActionErrorTypes.FETCH_PLUGINS_ERROR,
        ReduxActionErrorTypes.FETCH_DATASOURCES_ERROR,
        ReduxActionErrorTypes.FETCH_MOCK_DATASOURCES_ERROR,
      ],
    );
    if (!pluginsAndDatasourcesCalls) return;

    const pluginFormCall = yield failFastApiCalls(
      [fetchPluginFormConfigs()],
      [ReduxActionTypes.FETCH_PLUGIN_FORM_CONFIGS_SUCCESS],
      [ReduxActionErrorTypes.FETCH_PLUGIN_FORM_CONFIGS_ERROR],
    );
    if (!pluginFormCall) return;

    const actionsCall = yield failFastApiCalls(
      [fetchActions({ applicationId }, [executePageLoadActions()])],
      [ReduxActionTypes.FETCH_ACTIONS_SUCCESS],
      [ReduxActionErrorTypes.FETCH_ACTIONS_ERROR],
    );
    if (!actionsCall) return;

    const currentApplication: CurrentApplicationData = yield select(
      getCurrentApplication,
    );
    const appName = currentApplication ? currentApplication.name : "";
    const appId = currentApplication ? currentApplication.id : "";
    const applicationSlug = currentApplication.slug as string;
    const currentPage: Page = yield select(getPageById(toLoadPageId));
    //Comeback
    const pageSlug = currentPage?.slug as string;

    // Check if the the current route is a deprecated URL or if it has placeholder pageId,
    // generate a new route with the v2 structure.
    let originalUrl = "";
    if (
      isURLDeprecated(window.location.pathname) ||
      isPlaceholderPageId(pageId)
    ) {
      originalUrl = getApplicationEditorPageURL(
        applicationSlug,
        pageSlug,
        toLoadPageId,
      );
    } else {
      // For urls which has pageId in it,
      // replace the placeholder values of application slug and page slug with real slug names.
      originalUrl = updateRoute(window.location.pathname, {
        applicationSlug,
        pageSlug,
        pageId: toLoadPageId,
      });
    }

    window.history.replaceState(null, "", originalUrl);

    const branchInStore: string = yield select(getCurrentGitBranch);

    yield put(
      restoreRecentEntitiesRequest({
        applicationId: appId,
        branch: branchInStore,
      }),
    );

    yield put(fetchCommentThreadsInit());

    AnalyticsUtil.logEvent("EDITOR_OPEN", {
      appId: appId,
      appName: appName,
    });

    // init of temporay remote url from old application
    yield put(remoteUrlInputValue({ tempRemoteUrl: "" }));

    yield put({
      type: ReduxActionTypes.INITIALIZE_EDITOR_SUCCESS,
    });
    PerformanceTracker.stopAsyncTracking(
      PerformanceTransactionName.INIT_EDIT_APP,
    );

    yield call(populatePageDSLsSaga);

    // add branch query to path and fetch status
    if (branchInStore) {
      history.replace(addBranchParam(branchInStore));
      yield put(fetchGitStatusInit());
    }

    yield put(resetPullMergeStatus());
  } catch (e) {
    log.error(e);
    Sentry.captureException(e);
    yield put({
      type: ReduxActionTypes.SAFE_CRASH_APPSMITH_REQUEST,
      payload: {
        code: ERROR_CODES.SERVER_ERROR,
      },
    });
    return;
  }
}

export function* initializeAppViewerSaga(
  action: ReduxAction<{
    branch: string;
    pageId: string;
    applicationSlug: string;
  }>,
) {
  const { applicationSlug: appSlug, branch, pageId } = action.payload;

  let applicationId = isPlaceholderPageId(pageId) ? appSlug : "";

  if (!applicationId) {
    const currentPageInfo: FetchPageResponse = yield call(PageApi.fetchPage, {
      id: pageId,
    });
    applicationId = currentPageInfo.data.applicationId;
  }

  if (branch) yield put(updateBranchLocally(branch));

  if (!action.payload)
    PerformanceTracker.startAsyncTracking(
      PerformanceTransactionName.INIT_VIEW_APP,
    );
  yield put(setAppMode(APP_MODE.PUBLISHED));
  yield put(
    updateAppPersistentStore(getPersistentAppStore(applicationId, branch)),
  );
  yield put({ type: ReduxActionTypes.START_EVALUATION });
  const jsActionsCall = yield failFastApiCalls(
    [fetchJSCollectionsForView({ applicationId })],
    [ReduxActionTypes.FETCH_JS_ACTIONS_VIEW_MODE_SUCCESS],
    [ReduxActionErrorTypes.FETCH_JS_ACTIONS_VIEW_MODE_ERROR],
  );
  if (!jsActionsCall) return;
  const initCalls = [
    // TODO (hetu) Remove spl view call for fetch actions
    put(fetchActionsForView({ applicationId })),
    put(fetchPageList({ applicationId }, APP_MODE.PUBLISHED)),
    put(
      fetchApplication({
        payload: {
          applicationId,
          mode: APP_MODE.PUBLISHED,
        },
      }),
    ),
  ];

  const initSuccessEffects = [
    take(ReduxActionTypes.FETCH_ACTIONS_VIEW_MODE_SUCCESS),
    take(ReduxActionTypes.FETCH_PAGE_LIST_SUCCESS),
    take(ReduxActionTypes.FETCH_APPLICATION_SUCCESS),
  ];
  const initFailureEffects = [
    ReduxActionErrorTypes.FETCH_ACTIONS_VIEW_MODE_ERROR,
    ReduxActionErrorTypes.FETCH_PAGE_LIST_ERROR,
    ReduxActionErrorTypes.FETCH_APPLICATION_ERROR,
  ];

  yield all(initCalls);

  const resultOfPrimaryCalls = yield race({
    success: all(initSuccessEffects),
    failure: take(initFailureEffects),
  });

  if (resultOfPrimaryCalls.failure) {
    yield put({
      type: ReduxActionTypes.SAFE_CRASH_APPSMITH_REQUEST,
      payload: {
        code: get(
          resultOfPrimaryCalls,
          "failure.payload.error.code",
          ERROR_CODES.SERVER_ERROR,
        ),
      },
    });
    return;
  }

  const defaultPageId: string = yield select(getDefaultPageId);
  const toLoadPageId: string = isPlaceholderPageId(pageId)
    ? defaultPageId
    : pageId;

  if (toLoadPageId) {
    yield put(fetchPublishedPage(toLoadPageId, true));

    const resultOfFetchPage: {
      success: boolean;
      failure: boolean;
    } = yield race({
      success: take(ReduxActionTypes.FETCH_PUBLISHED_PAGE_SUCCESS),
      failure: take(ReduxActionErrorTypes.FETCH_PUBLISHED_PAGE_ERROR),
    });

    if (resultOfFetchPage.failure) {
      yield put({
        type: ReduxActionTypes.SAFE_CRASH_APPSMITH_REQUEST,
        payload: {
          code: get(
            resultOfFetchPage,
            "failure.payload.error.code",
            ERROR_CODES.SERVER_ERROR,
          ),
        },
      });
      return;
    }
  }

  yield put(setAppMode(APP_MODE.PUBLISHED));

  const { applicationSlug, pageSlug } = yield select(selectURLSlugs);

  let originalUrl = "";
  if (
    isURLDeprecated(window.location.pathname) ||
    isPlaceholderPageId(pageId)
  ) {
    originalUrl = getApplicationViewerPageURL({
      applicationSlug,
      pageSlug,
      pageId: toLoadPageId,
    });
  } else {
    originalUrl = updateRoute(window.location.pathname, {
      applicationSlug,
      pageSlug,
      pageId: toLoadPageId,
    });
  }

  window.history.replaceState(null, "", originalUrl);

  yield put(fetchCommentThreadsInit());

  yield put({
    type: ReduxActionTypes.INITIALIZE_PAGE_VIEWER_SUCCESS,
  });
  PerformanceTracker.stopAsyncTracking(
    PerformanceTransactionName.INIT_VIEW_APP,
  );
  if ("serviceWorker" in navigator) {
    yield put({
      type: ReduxActionTypes.FETCH_ALL_PUBLISHED_PAGES,
    });
  }
}

function* resetEditorSaga() {
  yield put(resetEditorSuccess());
  yield put(resetRecentEntities());
}

export function* waitForInit() {
  const isEditorInitialised: boolean = yield select(getIsEditorInitialized);
  const isViewerInitialized: boolean = yield select(getIsViewerInitialized);
  if (!isEditorInitialised && !isViewerInitialized) {
    yield take([
      ReduxActionTypes.INITIALIZE_EDITOR_SUCCESS,
      ReduxActionTypes.INITIALIZE_PAGE_VIEWER_SUCCESS,
    ]);
  }
}

export default function* watchInitSagas() {
  yield all([
    takeLatest(ReduxActionTypes.INITIALIZE_EDITOR, initializeEditorSaga),
    takeLatest(
      ReduxActionTypes.INITIALIZE_PAGE_VIEWER,
      initializeAppViewerSaga,
    ),
    takeLatest(ReduxActionTypes.RESET_EDITOR_REQUEST, resetEditorSaga),
  ]);
}
