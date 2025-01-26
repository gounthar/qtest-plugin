package com.qasymphony.ci.plugin.submitter;

import com.qasymphony.ci.plugin.exception.StoreResultException;
import com.qasymphony.ci.plugin.model.SubmittedResult;
import hudson.model.Run;

/**
 * @author trongle
 * @version 10/21/2015 2:37 PM trongle $
 * @since 1.0
 */
public interface JunitSubmitter {
  /**
   * Submit test result to qTest
   *
   * @param junitSubmitterRequest request
   * @return {@link JunitSubmitterResult}
   * @throws Exception Exception
   */
  JunitSubmitterResult submit(JunitSubmitterRequest junitSubmitterRequest) throws Exception;

  /**
   * @param junitSubmitterRequest JunitSubmitterRequest
   * @param run  {@link Run}
   * @param result {@link JunitSubmitterResult}
   * @param  buildResult build result test
   * @return {@link SubmittedResult}
   * @throws StoreResultException StoreResultException
   */
  SubmittedResult storeSubmittedResult(JunitSubmitterRequest junitSubmitterRequest, Run run, String buildResult, JunitSubmitterResult result)
    throws StoreResultException;
}
