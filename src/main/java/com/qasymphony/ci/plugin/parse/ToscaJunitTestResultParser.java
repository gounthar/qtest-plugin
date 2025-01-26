package com.qasymphony.ci.plugin.parse;

import com.qasymphony.ci.plugin.Constants;
import com.qasymphony.ci.plugin.model.AutomationAttachment;
import com.qasymphony.ci.plugin.model.AutomationTestResult;
import com.qasymphony.ci.plugin.model.AutomationTestStepLog;
import com.qasymphony.ci.plugin.utils.LoggerUtils;
import com.qasymphony.ci.plugin.utils.XMLFileUtils;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.File;
import java.io.PrintStream;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.logging.Logger;

/**
 * scan and parse Tosca Junit test results
 *
 * @author ngocminhchu
 * @version 1.0
 * @since 6/2/2020 1:15 PM ngocminhchu $
 */

/**
 * A sample of failed Tosca Junit log:
 * - Failed DN should fail\r\n;+ Passed  Create JSON Resource CHANGED\r\n\r\n+ Passed  Fill JSON Resource with numbers\r\n+ Passed   RootObject\r\n\r\n- Failed  Verify the numbers\r\n- Failed   RootObject\r\n\r\n
 */
public class ToscaJunitTestResultParser {
  private static final Logger LOG = Logger.getLogger(ToscaJunitTestResultParser.class.getName());

  /**
   * @param request request
   * @return list of {@link AutomationTestResult}
   * @throws Exception Exception
   */

  public static List<AutomationTestResult> parse(ParseRequest request) throws Exception {
    PrintStream logger = request.getListener().getLogger();
    LoggerUtils.formatInfo(logger, "Scan Tosca test results files and parse the results step.");

    String basedDir = request.getWorkSpace().toURI().getPath();
    String pattern = request.getParseTestResultPattern();
    List<String> resultFiles = CommonParsingUtils.scanTestResultFile(basedDir, pattern);
    Map<String, AutomationTestResult> map = new HashMap<>();
    int currentTestLogOrder = 1;
    for (String resultFile : resultFiles) {
      LOG.info("Parsing result file: " + resultFile);
      File file = new File(basedDir, resultFile);
      Document doc = XMLFileUtils.readXMLFile(file);
      doc.getDocumentElement().normalize();
      NodeList testCaseNodes = doc.getElementsByTagName("testcase");
      if (testCaseNodes.getLength() <= 0) {
        throw new Exception("Tosca Junit parser cannot find test cases");
      }
      for (int i = 0; i < testCaseNodes.getLength(); i++) {
        Node testCaseNode = testCaseNodes.item(i);
        AutomationTestResult testLog = buildTestCaseLog(testCaseNode, request.getOverwriteExistingTestSteps(), currentTestLogOrder, logger);
        if(testLog == null) {
          continue;
        }
        currentTestLogOrder++;
        String testCaseName = testLog.getName();
        if (!map.containsKey(testCaseName)) {
          map.put(testCaseName, testLog);
        }
      }
    }
    map = CommonParsingUtils.processAttachment(map);
    return new ArrayList<>(map.values());
  }

  private static AutomationTestResult buildTestCaseLog(Node testCaseNode, boolean overwriteExistingTestSteps, int currentTestLogOrder, PrintStream logger) {
    AutomationTestResult testLog = new AutomationTestResult();
    // make sure it's element node.
    if (testCaseNode.getNodeType() == Node.ELEMENT_NODE) {
      Element testCaseElement = (Element) testCaseNode;
      String testCaseName = testCaseElement.getAttribute("name");
      String startTime = testCaseElement.getAttribute("timestamp");
      String duration = testCaseElement.getAttribute("time");
      Date startDate;
      Date endDate;
      try {
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSSXXX");
        startDate = dateFormat.parse(startTime);

        Calendar calendar = Calendar.getInstance();
        calendar.setTime(startDate);
        double durationD= Double.parseDouble(duration);

        calendar.setTimeInMillis(calendar.getTimeInMillis() + (int)durationD*1000);
        endDate = calendar.getTime();
      } catch (Exception e) {
        startDate = new Date();
        endDate = new Date();
      }
      LoggerUtils.formatInfo(logger, "Getting test case info: " + testCaseName);

      String testStepsLogString = testCaseElement.getAttribute("log").trim();
      // ignore test case if it doesnt have log
      if (testStepsLogString.isEmpty()) {
        return null;
      }
      List<AutomationTestStepLog> testStepLogs = new ArrayList<>();
      List<AutomationAttachment> attachments = new ArrayList<>();

      if (overwriteExistingTestSteps) {
        testStepLogs = buildTestStepLogs(testStepsLogString);
      }

      AutomationAttachment attachment = buildAttachments(testStepsLogString, testCaseName);
      attachments.add(attachment);
      testLog.setOrder(currentTestLogOrder);
      testLog.setAutomationContent(testCaseName);
      testLog.setExecutedStartDate(startDate);
      testLog.setExecutedEndDate(endDate);
      testLog.setTestLogs(testStepLogs);
      testLog.setAttachments(attachments);
      testLog.setStatus(Constants.TestResultStatus.PASS);

      if (testStepsLogString.split(" ")[0].equals("-")) {
        testLog.setStatus(Constants.TestResultStatus.FAIL);
      } else if (Constants.TestResultStatus.ERROR.equalsIgnoreCase(testStepsLogString.split(" ")[0])){
        testLog.setStatus(Constants.TestResultStatus.ERROR);
      }
    }
    return testLog;
  }

  private static List<AutomationTestStepLog> buildTestStepLogs(String log) {
    List<AutomationTestStepLog> result = new ArrayList<>();
    List<String> logBlocks = Arrays.asList(log.split("\r\n\r\n", -1));
    for (int i=0; i<logBlocks.size(); i++) {
      String line = i == 0 ? logBlocks.get(i).split("\r\n")[1].trim() : logBlocks.get(i).split("\r\n")[0].trim();
      List<String> tokens = Arrays.asList(line.split(" "));
      AutomationTestStepLog testStepsLog = new AutomationTestStepLog();

      if (tokens.get(0).equals("+")) {
        testStepsLog.setStatus(Constants.TestResultStatus.PASS);
      } else if (tokens.get(0).equals("-")) {
        testStepsLog.setStatus(Constants.TestResultStatus.FAIL);
      } else if (Constants.TestResultStatus.ERROR.equalsIgnoreCase(tokens.get(0))) {
        testStepsLog.setStatus(Constants.TestResultStatus.ERROR);
      } else {
        return result;
      }

      String stepName = buildTestStepName(tokens, testStepsLog.getStatus());
      String actualResult = buildTestStepActualResult(line, tokens, testStepsLog.getStatus());

      testStepsLog.setDescription(stepName);
      testStepsLog.setExpectedResult(stepName);

      if (!actualResult.isEmpty()) {
        testStepsLog.setActualResult(actualResult);
      }
      testStepsLog.setOrder(i);

      result.add(testStepsLog);
    }
    return result;
  }

  private static String buildTestStepActualResult(String line, List<String> tokens, String status) {
    final String startIndicator = "{LogInfo=\'";
    String actualResult = new String();
    int startIndex = line.indexOf(startIndicator);
    if( startIndex > -1) {
      String fullLogInfoStr = line.substring(startIndex, line.length());
      String removedLeadingStr = fullLogInfoStr.replace(startIndicator, "");
      actualResult = removedLeadingStr.replace("\'}", "");
    }
    return actualResult;
  }

  private static String buildTestStepName(List<String> tokens, String status) {
    final String stopIndicator = "{LogInfo=\'";
    int startTokenIndex = 1;
    if (status == Constants.TestResultStatus.PASS || status == Constants.TestResultStatus.FAIL) {
      startTokenIndex = 2;
    }

    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < tokens.size(); i++) {
      if (i < startTokenIndex || tokens.get(i).isEmpty()) {
        continue;
      }
      // remove the LogInfo part
      if (tokens.get(i).indexOf(stopIndicator) > -1) {
        return sb.toString().trim();
      }
      sb.append(tokens.get(i));
      // if not the last item
      if (i != tokens.size() - 1) {
        sb.append(" ");
      }
    }
    return sb.toString();
  }

  private static AutomationAttachment buildAttachments(String log, String testCaseName) {
    AutomationAttachment attachment =  new AutomationAttachment();
    attachment.setName(testCaseName.concat(Constants.Extension.TEXT_FILE));
    attachment.setContentType(Constants.CONTENT_TYPE_TEXT);
    attachment.setData(log);
    return attachment;
  }
}
