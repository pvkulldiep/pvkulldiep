// A Custom hook to perform polling based on number of attempts and delay time.

import { useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectFeatureADocLoading,
  selectFeatureADocPdfData,
  selectHasDocError,
} from 'features/featureA/featureASelector';
import { startFeatureADocPDFPoll, getFeatureADocStart, stopFeatureADocPDFPoll, resetFeatureADocPDF } from 'features/featureA/featureASlice';
import { METHODS } from 'http';

const useFetchFeatureADoc = () => {
  const dispatch = useDispatch();
  const isFeatureADocLoading = useSelector(selectFeatureADocLoading);
  const hasDocError = useSelector(selectHasDocError);
  const { documentCorrelationId, getPDFAttempt, getPDFTimeBreakInMilliSec, orders } = useSelector(
    selectFeatureADocPdfData
  ); // A Redux selector holding the above values on successful API response of a Saga Reducer

  /** 
   *  Note: This condition is also handled in the FeatureA saga (getFeatureADocSaga) which would stop the loader and display an error message based on the API failure. 
   *  Hence, if any change here in this condition so it should be update that place also.
  */
  const canStartPoll = documentCorrelationId && orders[0]?.disclaimerIds?.length && !orders[0]?.disclaimerIds?.includes('NoSimulationPossible');

  const startPDFPoll = useCallback(() => {
    dispatch(
      startFeatureADocPDFPoll(
        { documentCorrelationId, getPDFAttempt, getPDFTimeBreakInMilliSec }),
    );
  }, [documentCorrelationId, getPDFAttempt, getPDFTimeBreakInMilliSec]);


  useEffect(() => {
    return () => {
      dispatch(stopFeatureADocPDFPoll());
      // also reset the FeatureADoc data, during destroy
      // Scenario: If we go back, to the Home screen, the existing data would be reset. 
      dispatch(resetFeatureADocPDF());
    }
  }, [])

  // Side effect to trigger, whenever the canPollorStop changes from false to true
  useEffect(() => {
    canStartPoll && startPDFPoll();
  }, [canStartPoll]);

  const handleFeatureADoc = useCallback((payload) => {
    if (!documentCorrelationId) {
      dispatch(
        getFeatureADocStart(payload),
      );
    } else {
      // if doc correlation id is already existing, start the poll directly
      canStartPoll && startPDFPoll();
    }
  }, [documentCorrelationId, canStartPoll])

  return {
    handleFeatureADoc,
    isFeatureADocLoading,
    hasDocError
  };
};

export default useFetchFeatureADoc;


// Saga Reducer

export function* getFeaturADocSaga(action: PayloadAction<Promise<Response | Error>>) {
    try {
      const payload = action?.payload;
      const bearerToken = (yield select((state) => state.session.bearerToken)) as string;
      const response: AxiosResponse = yield call(() =>
        // Axios API to fetch the Response
      );
      if (response?.data?.documentCorrelationId && response?.data?.orders[0]?.disclaimerIds?.length && !response?.data?.orders[0]?.disclaimerIds?.includes('NoSimulationPossible')) {
        yield put(getFeatureADocDocsSuccess(response?.data));
      } else {
        yield put(getFeatureADocDocsFail());
      }
    } catch (error) {
      yield put(getFeatureADocDocsFail());
    }
  }
  
  export function* pdfAttempt(currentAttempt: number, totalAttempt: number, delayTimeout: number) {
    if (currentAttempt < totalAttempt){
      yield delay(delayTimeout)
    }
  }
  
  function* getPDF(action: PayloadAction<Promise<Response | Error>>) {
    const { documentCorrelationId, getPDFAttempt, getPDFTimeBreakInMilliSec  } = action.payload;
    const bearerToken = (yield select((state) => state.session.bearerToken)) as string;
    for (let i = 0; i < getPDFAttempt; i++) {
      try {
        const apiResponse: AxiosResponse= yield call(() =>
          // Axios API to fetch the Response
        );
        if (apiResponse?.data?.isPdfAvailable) {
          return apiResponse;
        }
        yield call(() => pdfAttempt(i, getPDFAttempt, getPDFTimeBreakInMilliSec));
      } catch (err) {
        yield call(() => pdfAttempt(i, getPDFAttempt, getPDFTimeBreakInMilliSec));
      }
    }
    
    throw new Error('API request failed')
  }
  
  export function* getFeatureADocPDFSaga(action: PayloadAction<Promise<Response | Error>>) {
    try {
      const response: AxiosResponse = yield call(getPDF, action);
      yield put(FeatureADocPDFPollSuccess(response));
    } catch (error) {
      yield put(FeatureADocPDFPollFail());
    }
  }
  
  /**
   * This method initializes the polling loop that does two things:
   *
   * 1. creates a forked task from the poll API call
   * 2. passes in the forked task as an argument to a watching function that will cancel a task given a certain condition (i.e. an action to stopPolling is called)
   *
   * @method pollOrCancelFeatureADocPDF
   */
  export function *pollOrCancelFeatureADocPDF(action: PayloadAction<Promise<Response>>) {
    const pollTask = yield fork(() => getFeatureADocPDFSaga(action));
    yield watchCancelPoll(pollTask);
  }
  
  /**
   * Cancel the polling task
   * @param pollTask
   */
  export function *cancelPolling(pollTask) {
    yield cancel(pollTask);
  }
  
  /**
   * Saga listening to the stopFeatureADocPDFPoll action
   * @param pollTask
   */
  export function *watchCancelPoll(pollTask) {
    yield takeLatest(stopFeatureADocPDFPoll, () => cancelPolling(pollTask));
  }
