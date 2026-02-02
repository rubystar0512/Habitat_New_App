import React, { useState, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  message,
  Row,
  Col,
  Tag,
  Collapse,
  Tooltip,
  Input,
} from 'antd';
import {
  FileTextOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
// Using browser's built-in DOMParser for XML parsing

const { Title, Text } = Typography;
const { Panel } = Collapse;

const XMLViewer = () => {
  const [xmlContent, setXmlContent] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [selectedFailure, setSelectedFailure] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const handleFileLoad = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      message.error('Please select an XML file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setXmlContent(content);
      parseXML(content);
    };
    reader.onerror = () => {
      message.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const parseXML = (xmlString) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        message.error('Failed to parse XML: ' + parserError.textContent);
        return;
      }

      // Handle Gradle/JUnit XML format
      const testSuites = extractTestSuites(xmlDoc);
      
      // Debug: Log parsing results
      console.log('Parsed test suites:', testSuites);
      const totalFailures = testSuites.reduce((sum, suite) => sum + (suite.failures || 0), 0);
      console.log('Total failures detected:', totalFailures);
      
      setParsedData(testSuites);
      message.success(`XML file loaded successfully. Found ${testSuites.length} test suite(s) with ${totalFailures} failure(s).`);
    } catch (err) {
      message.error('Failed to parse XML: ' + err.message);
    }
  };

  const extractTestSuites = (xmlDoc) => {
    const suites = [];
    
    // Handle testsuites element (multiple suites)
    const testsuitesEl = xmlDoc.querySelector('testsuites');
    if (testsuitesEl) {
      const suiteElements = testsuitesEl.querySelectorAll(':scope > testsuite');
      suiteElements.forEach((suiteEl, idx) => {
        suites.push(parseTestSuite(suiteEl, idx));
      });
    } else {
      // Handle single testsuite element
      const suiteEl = xmlDoc.querySelector('testsuite');
      if (suiteEl) {
        suites.push(parseTestSuite(suiteEl, 0));
      }
    }

    return suites;
  };

  const parseTestSuite = (suiteEl, index) => {
    const testCases = [];
    const failures = [];
    
    const testCaseElements = suiteEl.querySelectorAll('testcase');
    testCaseElements.forEach((testCaseEl, caseIdx) => {
      const name = testCaseEl.getAttribute('name') || `Test ${caseIdx + 1}`;
      const className = testCaseEl.getAttribute('classname') || '';
      const time = testCaseEl.getAttribute('time') || '0';
      
      const caseData = {
        id: `${index}-${caseIdx}`,
        name,
        className,
        time,
        status: 'PASS',
        failure: null,
      };

      // Check for failures or errors - handle different XML structures
      const failureEl = testCaseEl.querySelector('failure');
      const errorEl = testCaseEl.querySelector('error');
      
      if (failureEl || errorEl) {
        const failureElement = failureEl || errorEl;
        
        // Get failure message - could be in message attribute, textContent, or innerHTML
        let failureMsg = failureElement.getAttribute('message') || '';
        if (!failureMsg) {
          failureMsg = failureElement.textContent || failureElement.innerHTML || '';
        }
        
        // Get failure type attribute if present
        const failureTypeAttr = failureElement.getAttribute('type') || '';
        const failureType = failureEl ? 'failure' : 'error';
        
        caseData.status = 'FAIL';
        caseData.failure = {
          type: failureType,
          message: failureMsg.trim() || 'Test failed',
          typeAttr: failureTypeAttr,
          full: failureMsg.trim() || 'Test failed',
        };
        failures.push(caseData);
        
        console.log(`Found failure in test case: ${caseData.name}`, caseData.failure);
      }
      
      // Also check if testcase has a failure attribute (some XML formats)
      const hasFailureAttr = testCaseEl.getAttribute('failure') === 'true' || 
                             testCaseEl.hasAttribute('failure');
      if (hasFailureAttr && !caseData.failure) {
        caseData.status = 'FAIL';
        caseData.failure = {
          type: 'failure',
          message: 'Test failed (marked in XML attributes)',
          full: 'Test failed (marked in XML attributes)',
        };
        failures.push(caseData);
        console.log(`Found failure attribute in test case: ${caseData.name}`);
      }

      testCases.push(caseData);
    });

    const name = suiteEl.getAttribute('name') || `Test Suite ${index + 1}`;
    const tests = parseInt(suiteEl.getAttribute('tests') || testCases.length, 10);
    const failuresAttr = parseInt(suiteEl.getAttribute('failures') || failures.length, 10);
    const errors = parseInt(suiteEl.getAttribute('errors') || 0, 10);
    const time = suiteEl.getAttribute('time') || '0';

    // Use actual parsed failures count, not just XML attribute (XML might be incorrect)
    const actualFailures = failures.length;
    
    return {
      id: `suite-${index}`,
      name,
      tests,
      failures: actualFailures > 0 ? actualFailures : failuresAttr, // Number: count of failures
      errors,
      time,
      testCases,
      failuresList: failures, // Array: detailed failure objects (renamed to avoid conflict)
    };
  };

  const fallbackCopyToClipboard = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        message.success('Copied to clipboard');
      } else {
        message.error('Failed to copy to clipboard');
      }
    } catch (err) {
      message.error('Failed to copy to clipboard');
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const copyToClipboard = (text, successMessage = 'Copied to clipboard') => {
    // Check if Clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => {
        message.success(successMessage);
      }).catch(() => {
        // Fallback to execCommand if clipboard API fails
        fallbackCopyToClipboard(text);
      });
    } else {
      // Fallback to execCommand for older browsers or non-HTTPS contexts
      fallbackCopyToClipboard(text);
    }
  };

  const handleCopyFailure = (record) => {
    if (!record || record.status !== 'FAIL' || record.type !== 'case') return;
    
    // Get the actual test case with failure data from parsedData
    const parentSuite = parsedData.find(suite => suite.id === record.parentId);
    const actualTestCase = parentSuite?.testCases.find(tc => String(tc.id) === record.key);
    
    if (!actualTestCase || !actualTestCase.failure) {
      message.warning('Failure details not available');
      return;
    }
    
    const failureText = formatFailureForCopy(actualTestCase);
    copyToClipboard(failureText, 'Copied failure details to clipboard');
  };

  const handleCopyAllFailures = () => {
    if (!parsedData) return;

    const allFailures = [];
    parsedData.forEach(suite => {
      // Iterate through test cases to find failures
      suite.testCases.forEach(testCase => {
        if (testCase.status === 'FAIL' && testCase.failure) {
          allFailures.push({
            suite: suite.name,
            name: testCase.name,
            className: testCase.className,
            type: testCase.failure.type || 'failure',
            message: testCase.failure.message || 'Test failed',
          });
        }
      });
    });

    if (allFailures.length === 0) {
      message.info('No failures to copy');
      return;
    }

    const failureText = allFailures.map((f, idx) => {
      return `=== Failure ${idx + 1} ===\nSuite: ${f.suite}\nTest: ${f.name || 'Unknown'}\nClass: ${f.className || 'Unknown'}\nType: ${f.type}\nMessage:\n${f.message}\n\n`;
    }).join('\n');

    copyToClipboard(failureText, `Copied ${allFailures.length} failure(s) to clipboard`);
  };

  const formatFailureForCopy = (testCase) => {
    if (!testCase || !testCase.failure) return '';
    const failure = testCase.failure;
    return `Test: ${testCase.name || 'Unknown'}\nClass: ${testCase.className || 'Unknown'}\nType: ${failure.type || 'failure'}\nMessage:\n${failure.message || 'Test failed'}`;
  };

  const totalStats = useMemo(() => {
    if (!parsedData) return { tests: 0, failures: 0, errors: 0, time: 0 };
    
    return parsedData.reduce((acc, suite) => ({
      tests: acc.tests + suite.tests,
      failures: acc.failures + suite.failures,
      errors: acc.errors + suite.errors,
      time: acc.time + parseFloat(suite.time || 0),
    }), { tests: 0, failures: 0, errors: 0, time: 0 });
  }, [parsedData]);

  const columns = [
    {
      title: 'Test Suite / Test Case',
      dataIndex: 'name',
      key: 'name',
      ellipsis: false,
      render: (text, record) => {
        const displayName = String(text || record?.name || 'Unknown');
        return (
          <Space>
            {record?.type === 'suite' ? (
              <FolderOutlined style={{ color: 'rgb(148, 163, 184)' }} />
            ) : (
              <FileOutlined style={{ color: 'rgb(148, 163, 184)' }} />
            )}
            <Text style={{ color: 'rgb(241, 245, 249)', fontSize: 13 }} ellipsis={false}>{displayName}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      ellipsis: false,
      render: (status) => {
        const statusStr = String(status || 'PASS');
        if (statusStr === 'FAIL') {
          return <Tag color="red" icon={<CloseCircleOutlined />}>FAILURE</Tag>;
        }
        return <Tag color="green" icon={<CheckCircleOutlined />}>PASS</Tag>;
      },
    },
    {
      title: 'Tests',
      dataIndex: 'tests',
      key: 'tests',
      width: 80,
      align: 'center',
      ellipsis: false,
      render: (tests) => {
        const testsNum = typeof tests === 'number' ? tests : (typeof tests === 'string' ? parseInt(tests, 10) : 0);
        return <Text style={{ color: 'rgb(148, 163, 184)' }} ellipsis={false}>{testsNum || 0}</Text>;
      },
    },
    {
      title: 'Failures',
      dataIndex: 'failures',
      key: 'failures',
      width: 100,
      align: 'center',
      ellipsis: false,
      render: (failures) => {
        const failuresNum = typeof failures === 'number' ? failures : (typeof failures === 'string' ? parseInt(failures, 10) : 0);
        return (
          <Text style={{ color: failuresNum > 0 ? '#ef4444' : 'rgb(148, 163, 184)' }} ellipsis={false}>
            {failuresNum || 0}
          </Text>
        );
      },
    },
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      width: 100,
      align: 'center',
      ellipsis: false,
      render: (time) => {
        const timeValue = typeof time === 'string' ? parseFloat(time) : (typeof time === 'number' ? time : 0);
        return <Text ellipsis={false}>{timeValue.toFixed(3)}s</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => {
        if (record.type === 'case' && record.status === 'FAIL') {
          return (
            <Tooltip title="Copy failure details">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyFailure(record);
                }}
                style={{ color: '#ef4444' }}
              />
            </Tooltip>
          );
        }
        return null;
      },
    },
  ];

  // Flatten data for table display
  const tableData = useMemo(() => {
    if (!parsedData) return [];
    
    const data = [];
    parsedData.forEach((suite, suiteIndex) => {
      // Calculate actual failures from test cases (in case XML attributes are wrong)
      const actualFailuresFromCases = suite.testCases.filter(tc => tc.status === 'FAIL' || tc.failure).length;
      const suiteFailures = actualFailuresFromCases > 0 ? actualFailuresFromCases : (Number(suite.failures) || 0);
      
      // Add suite row - create clean object with only primitives
      const suiteRow = {
        key: String(suite.id || ''),
        name: String(suite.name || `Test Suite ${suiteIndex + 1}`),
        status: String(suiteFailures > 0 ? 'FAIL' : 'PASS'),
        tests: Number(suite.tests) || 0,
        failures: Number(suiteFailures),
        errors: Number(suite.errors) || 0,
        time: String(suite.time || '0'),
        type: String('suite'),
        _suiteIndex: Number(suiteIndex),
      };
      // Use JSON parse/stringify to ensure completely clean object
      data.push(JSON.parse(JSON.stringify(suiteRow)));

      // Always show test cases if suite has failures, or if suite is manually expanded
      const shouldShowCases = expandedRows.has(suite.id) || suite.failures > 0;
      
      if (shouldShowCases) {
        suite.testCases.forEach((testCase) => {
          // Create clean object with only primitives - ensure no object references
          const rowData = {
            key: String(testCase.id || ''),
            name: String(testCase.name || 'Unknown Test'),
            className: String(testCase.className || ''),
            status: String(testCase.status || 'PASS'),
            tests: Number(1),
            failures: Number((testCase.status === 'FAIL' || testCase.failure) ? 1 : 0),
            time: String(testCase.time || '0'),
            type: String('case'),
            parentId: String(suite.id || ''),
          };
          
          // Store minimal failure info as strings (not objects) for Ant Design compatibility
          if (testCase.failure && typeof testCase.failure === 'object') {
            rowData._hasFailure = Boolean(true);
            rowData._failureType = String(testCase.failure.type || 'failure');
            const msg = testCase.failure.message || 'Test failed';
            rowData._failureMessage = String(typeof msg === 'string' ? msg : String(msg)).substring(0, 200);
          }
          
          // Use JSON parse/stringify to ensure completely clean object with no references or hidden properties
          data.push(JSON.parse(JSON.stringify(rowData)));
        });
      }
    });

    return data;
  }, [parsedData, expandedRows]);

  const handleRowClick = (record) => {
    if (record.type === 'suite') {
      const newExpanded = new Set(expandedRows);
      if (newExpanded.has(record.key)) {
        newExpanded.delete(record.key);
      } else {
        newExpanded.add(record.key);
      }
      setExpandedRows(newExpanded);
    } else if (record.type === 'case' && record.status === 'FAIL') {
      // Find the parent suite and the actual test case with failure data
      const parentSuite = parsedData.find(suite => suite.id === record.parentId);
      const actualTestCase = parentSuite?.testCases.find(tc => String(tc.id) === record.key);
      
      if (actualTestCase && actualTestCase.failure) {
        setSelectedFailure({
          name: actualTestCase.name,
          className: actualTestCase.className,
          status: actualTestCase.status,
          failure: actualTestCase.failure,
          suiteData: parentSuite,
        });
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 12,
          overflowY: 'hidden',
          height: 'calc(85vh)',
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
              XML Test Results Viewer
            </Title>
            {xmlContent && (
              <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12, display: 'block', marginTop: 4 }}>
                Loaded: {document.querySelector('input[type="file"]')?.files[0]?.name || 'XML file'}
              </Text>
            )}
          </Col>
          <Col>
            <Space>
              <input
                type="file"
                accept=".xml"
                onChange={handleFileLoad}
                style={{ display: 'none' }}
                id="xml-file-input"
              />
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => document.getElementById('xml-file-input').click()}
              >
                Open XML File
              </Button>
              {parsedData && totalStats.failures > 0 && (
                <Button
                  danger
                  icon={<CopyOutlined />}
                  onClick={handleCopyAllFailures}
                >
                  Copy Failures
                </Button>
              )}
            </Space>
          </Col>
        </Row>

        {parsedData ? (
          <>
            {/* Summary Stats */}
            <Row style={{ marginBottom: 16 }}>
              <Col span={24}>
                <Space size="large">
                  <Text style={{ color: 'rgb(148, 163, 184)' }}>
                    <strong style={{ color: 'rgb(241, 245, 249)' }}>Tests:</strong> {totalStats.tests}
                  </Text>
                  <Text style={{ color: totalStats.failures > 0 ? '#ef4444' : 'rgb(148, 163, 184)' }}>
                    <strong style={{ color: totalStats.failures > 0 ? '#ef4444' : 'rgb(241, 245, 249)' }}>Failures:</strong> {totalStats.failures}
                  </Text>
                  <Text style={{ color: totalStats.errors > 0 ? '#ef4444' : 'rgb(148, 163, 184)' }}>
                    <strong style={{ color: totalStats.errors > 0 ? '#ef4444' : 'rgb(241, 245, 249)' }}>Errors:</strong> {totalStats.errors}
                  </Text>
                  <Text style={{ color: 'rgb(148, 163, 184)' }}>
                    <strong style={{ color: 'rgb(241, 245, 249)' }}>Time:</strong> {totalStats.time.toFixed(3)}s
                  </Text>
                </Space>
              </Col>
            </Row>

            <Row gutter={16}>
              {/* Test Results Table */}
              <Col xs={24} lg={16}>
                <Table
                  columns={columns}
                  dataSource={tableData}
                  rowKey={(record) => String(record.key || record.id || Math.random())}
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content', y: 'calc(61vh)' }}
                  onRow={(record) => ({
                    onClick: () => handleRowClick(record),
                    style: {
                      cursor: 'pointer',
                      backgroundColor: record.status === 'FAIL' && record.type === 'suite' 
                        ? 'rgba(239, 68, 68, 0.1)' 
                        : record.status === 'FAIL' && record.type === 'case'
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'transparent',
                    },
                  })}
                  style={{
                    background: '#0f172a',
                  }}
                />
              </Col>

              {/* Failure Details Panel */}
              <Col xs={24} lg={8}>
                <Card
                  title="Details"
                  extra={
                    parsedData && totalStats.failures > 0 && (
                      <Button
                        danger
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={handleCopyAllFailures}
                      >
                        Copy Failures
                      </Button>
                    )
                  }
                  style={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                  }}
                >
                  {selectedFailure && selectedFailure.failure ? (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <Text strong style={{ color: 'rgb(241, 245, 249)', display: 'block', marginBottom: 8 }}>
                          TEST SUITE
                        </Text>
                        <Text style={{ color: 'rgb(148, 163, 184)', display: 'block' }}>
                          Name: {selectedFailure.suiteData?.name || 'Unknown'}
                        </Text>
                        <Text style={{ color: 'rgb(148, 163, 184)', display: 'block' }}>
                          Tests: {selectedFailure.suiteData?.tests || 0}
                        </Text>
                        <Text style={{ color: '#ef4444', display: 'block' }}>
                          Failures: {selectedFailure.suiteData?.failures || 0}
                        </Text>
                        <Text style={{ color: 'rgb(148, 163, 184)', display: 'block' }}>
                          Errors: {selectedFailure.suiteData?.errors || 0}
                        </Text>
                      </div>
                      <div>
                        <Text strong style={{ color: 'rgb(241, 245, 249)', display: 'block', marginBottom: 8 }}>
                          FAILURE DETAILS
                        </Text>
                        <Text style={{ color: 'rgb(148, 163, 184)', display: 'block', marginBottom: 4 }}>
                          Test: {selectedFailure.name}
                        </Text>
                        <Text style={{ color: 'rgb(148, 163, 184)', display: 'block', marginBottom: 4 }}>
                          Class: {selectedFailure.className || 'N/A'}
                        </Text>
                        <Text style={{ color: 'rgb(148, 163, 184)', display: 'block', marginBottom: 8 }}>
                          Type: {selectedFailure.failure.type}
                        </Text>
                        <Input.TextArea
                          value={selectedFailure.failure.message}
                          readOnly
                          rows={10}
                          style={{
                            background: '#1e293b',
                            color: 'rgb(241, 245, 249)',
                            border: '1px solid #334155',
                            fontFamily: 'monospace',
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Text style={{ color: 'rgb(148, 163, 184)' }}>
                        {totalStats.failures > 0 
                          ? "Click on a failure in the table to view details, or click 'Copy Failures' to copy all failure details."
                          : "No failures found. All tests passed!"}
                      </Text>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgb(148, 163, 184)' }}>
            <FileTextOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }} />
            <Text style={{ display: 'block', fontSize: 16, marginBottom: 8 }}>
              No XML file loaded
            </Text>
            <Text style={{ display: 'block', fontSize: 12 }}>
              Click "Open XML File" to load a Gradle test results XML file
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default XMLViewer;
