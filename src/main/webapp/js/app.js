qtest.init();
var currentSelectedNodeId = -1;
var currentJSONContainer = {
        selectedContainer: {
            name: "",
            dailyCreateTestSuite: true
        },
        containerPath: []
    };
function toggleNewUI(enabled) {
    var options = $j("input[name*='config.submitToContainer']");
    if (2 === options.length) {
        var submitToContainerID = $j(options[1]).attr("id");
        if (!enabled) {
            $j(options[0]).trigger('click');
            $j("tr[ref='" + submitToContainerID + "'] :input").attr("disabled", true);
            $j("#overwriteExistingTestSteps").attr("disabled", true);
        } else {
            $j("tr[ref='" + submitToContainerID + "'] :input").removeAttr("disabled");
            $j("#overwriteExistingTestSteps").attr("disabled", false);
        }
    }
}
$j(document).ready(function () {
  setTimeout(function () {
    disableTextBox(true);
    toggleControls(true);
    onLoadProject();
    bindSelectizeChange();
    handleChangeToscaIntegrationOption();
    hideNoHelp();
    initContainerJSON();
    currentJSONContainer.selectedContainer.dailyCreateTestSuite = $j("#createNewTestRun").prop("checked");
    $j("input[name='config.url']").trigger("change");
  }, 1000);
  $j(document).on("click", ".content", function(event) {
    var htmlPrevNode = document.querySelector("div[qtestid='" + currentSelectedNodeId + "']");
    if (htmlPrevNode) {
        $j(htmlPrevNode).removeAttr("selected");
    }
    var contentItem = event.currentTarget;
    var nodeId = +contentItem.getAttribute("qtestid");
    var nodeType = contentItem.getAttribute("qtesttype");
    if (nodeType === 'release' || nodeType === 'test-cycle') {
        $j("#createNewTestRun").prop('disabled', false);
    } else {
        $j("#createNewTestRun").prop('disabled', true);
    }
    if (nodeId > 0 && nodeType) {
        $j(contentItem).attr("selected", "true");
        currentSelectedNodeId = nodeId;
    }
    updateSelectedContainer(contentItem);
  });

  $j(document).on("change", "input[name='config.url']", function(event) {
      qtest.getQtestInfo($j(this).val(), function(data) {
          var enabled = false;
          if (data && data.qTestInfo.version && data.qTestInfo.name) {
            var name = (data.qTestInfo.name || "").toLowerCase();
            var versions = (data.qTestInfo.version || "").split(".");
            if (("test-conductor" === name || "${pom.name}" === name) && 3 === versions.length) {
                // 8.9.3
                if (
                   (+versions[0] === 8 && +versions[1] > 9)
                || (+versions[0] === 8 && +versions[1] === 9 && +versions[2] > 3)
                || (+versions[0] > 8)
                ) {
                    enabled = true;
                }
            }
          }
          toggleNewUI(enabled);
       });
    });
   $j(document).on("remove", "#containerTree", function (event) {
    console.log("containerTree removed");
  });
  $j("select.setting-input").change(function(event) {
    $j('html').find('script').filter(function(){
        try {
            return $j(this).attr('name') === 'qtestScript'
        } catch(ex) {
            return false;
        }

    }).remove();
  });
  $j(document).on("click", "input[name='toscaIntegration']", function (event) {
    handleChangeToscaIntegrationOption();
  });
  $j(document).on("click", "#createNewTestRun", function (event) {
    currentJSONContainer.selectedContainer.dailyCreateTestSuite = $j(this).prop('disabled') ? false : $j(this).prop( "checked" );
      if (Object.toJSON) {
          // Prototype.js
          document.querySelector("input[name='config.containerSetting']").value =  Object.toJSON(currentJSONContainer);
      } else {
          // Standard
          document.querySelector("input[name='config.containerSetting']").value =  JSON.stringify(currentJSONContainer);
      }
  });
  $j(document).on("click", ".collapse-indicator, .expand-indicator", function(event) {
    //console.log(event);
    var toggleSubItem = function(jIndicatorItem, jSubContent) {
        jSubContent.slideToggle(300, function() {
            var className =  jSubContent.is(":visible") ?  "expand-indicator": "collapse-indicator";
            changeIndicator(jIndicatorItem, className);
        });
    };
    try {
        if (event.currentTarget) {
            if (event.currentTarget.hasAttribute("requested")){
                toggleSubItem($j(event.currentTarget), $j(event.currentTarget.parentElement.nextElementSibling));
            } else {
                changeIndicator($j(event.currentTarget), "loading-indicator");
                var contentItem = event.currentTarget.parentElement.querySelector("div[class='content']");
                var nodeId = contentItem.getAttribute("qtestid");
                var nodeType = contentItem.getAttribute("qtesttype");
                qtest.getContainerChildren(nodeId, nodeType, function(data) {
                    if (!loadContainers($j(event.currentTarget.parentElement.nextElementSibling), data, nodeId)) {
                        changeIndicator($j(event.currentTarget), "empty-indicator");
                        return;
                    }
                    toggleSubItem($j(event.currentTarget), $j(event.currentTarget.parentElement.nextElementSibling));
                });
                event.currentTarget.setAttribute("requested", "true");
            }
        }
    } catch (ex) {
        console.error(ex);
    }
  });
});

function handleChangeToscaIntegrationOption() {
    var toscaIntegrationCheckbox = $j("input[name='toscaIntegration']");
    var resultOptionContainer = $j("#qtest-result-options");
    var resultOptionInputs = $j("#qtest-result-options :input");
    if (toscaIntegrationCheckbox.is(":checked")) {
        resultOptionInputs.prop("disabled", true);
        resultOptionContainer.addClass("block-disabled");
    } else {
        resultOptionInputs.prop("disabled", false);
        resultOptionContainer.removeClass("block-disabled");
    }
}

function changeIndicator(jNode, className) {
    jNode.removeClass();
    jNode.addClass(className);
}
function bindSelectizeChange() {
  qtest.bindSelectizeValue("input[name='config.projectName1']", "input[name='config.projectId']",
    "input[name='config.projectName']", "id", "name", function (item) {
      loadProjectData();
    });
  qtest.bindSelectizeValue("input[name='config.releaseName1']", "input[name='config.releaseId']",
    "input[name='config.releaseName']", "id", "name");
  qtest.bindSelectizeValue("input[name='config.environmentName1']", "input[name='config.environmentId']",
    "input[name='config.environmentName']", "value", "label", function(item) {
        $j("input[name='config.environmentParentId']").val(item.field_id);
    });
}
/*Hide unexpected help icon for fields, cause jenkins auto make help url of radio block inherit by our publish action help url*/
function hideNoHelp() {
  var parent = $j("div[descriptorid='com.qasymphony.ci.plugin.action.PushingResultAction']");
  if (!parent || parent.length <= 0)
    return;
  var trNodes = parent.find("tr[class='radio-block-start '][hashelp='false'] > td[class='setting-help']");

  $j.each(trNodes, function (index) {
    var helpNode = trNodes[index];
    if (helpNode)
      helpNode.setAttribute('style', 'display:none');
  });
}

function disableTextBox(disable) {
  if (disable) {
    $j("input[name='config.projectName1']").attr('readonly', 'readonly');
    $j("input[name='config.releaseName1']").attr('readonly', 'readonly');
    $j("input[name='config.environmentName1']").attr('readonly', 'readonly');
    $j("input[name='fakeContainerName']").attr('readonly', 'readonly');
    $j("#createNewTestRun").prop('disabled', true);
  } else {
    $j("input[name='config.projectName1']").removeAttr('readonly');
    $j("input[name='config.releaseName1']").removeAttr('readonly');
    $j("input[name='config.environmentName1']").removeAttr('readonly');
    //$j("input[name='fakeContainerName']").removeAttr('readonly');
    $j("#createNewTestRun").prop('disabled', false);
  }
}
function toggleControls(visible) {
    if (visible) {
        $j("input[name='fakeContainerName']").show();
        $j("#containerTree").hide();
    } else {
        $j("input[name='fakeContainerName']").hide();
        $j("#containerTree").show();
    }
}
function onLoadProject() {
  $j("#fetchProjectData").on('click', function (e) {
    $j(this).prop('disabled', true);
    try {
        e.preventDefault();
        qtest.showLoading(this);
        disableTextBox(false);
        toggleControls(false);
        loadProject();
    } catch(ex) {

    }
    $j(this).prop('disabled', false)
  });
}
function clearProjectData() {
  //clear release & environment
  bindRelease([]);
  bindEnvironment([]);
  $j('#containerTree').empty();
  $j("input[name='config.environmentId']").val("");
  $j("input[name='config.environmentName']").val("");
}
function bindRelease(releases) {
  qtest.initSelectize("input[name='config.releaseName1']", 'selectizeRelease', releases,
    {
      labelField: 'name',
      searchField: ['pid', 'name'],
      render: {
        item: function (item, escape) {
          return '<div>' + escape(item.pid) + ' ' + escape(item.name) + '</div>';
        },
        option: function (item, escape) {
          return '<div>' + escape(item.pid) + ' ' + escape(item.name) + '</div>';
        }
      }
    });
}
function bindEnvironment(envs) {
  qtest.initSelectize("input[name='config.environmentName1']", 'selectizeEnvironment', envs,
    {
      create: true,
      valueField: 'value',
      labelField: 'label',
      searchField: 'label'
    });
}

function loadProject() {
  clearProjectData();
  var btn = $j("#fetchProjectData")[0];
  qtest.fetchProjects(function (data) {
    var projects = [];
    if (data.projects && data.projects != "") {
      projects = data.projects;
    }

    qtest.initSelectize("input[name='config.projectName1']", 'selectizeProject', projects);

    //get current saved project:
    var configuredProjectId = $j("input[name='config.projectId']").val();
    var selectedProject = null;
    if (projects.length > 0) {
      selectedProject = configuredProjectId ? qtest.find(projects, 'id', configuredProjectId) : projects[0];
    }
    qtest.hideLoading(btn);
    if (selectedProject)
      qtest.selectizeProject.setValue(selectedProject.id);
  }, function () {
    qtest.hideLoading(btn);
  })
}

function loadProjectData() {
  clearProjectData();
  currentSelectedNodeId = -1;
  currentJSONContainer = {
    selectedContainer: {
        name: "",
        dailyCreateTestSuite: $j("#createNewTestRun").prop("checked")
    },
    containerPath: []
  };
 updateSelectedContainer(undefined);
  var btn = $j("#fetchProjectData")[0];
  if (qtest.getProjectId() <= 0) {
    qtest.hideLoading(btn);
    return;
  }
  qtest.showLoading(btn);
  qtest.fetchProjectData(function (data) {
    //Saved configuration from qTest for this project of jenkins instance
    qtest.setting = {};
    if (data.setting && data.setting != "") {
      qtest.setting = data.setting;
    }
    loadRelease(data);
    loadEnvironment(data);
    $j('#containerTree').empty();
    loadContainers($j('#containerTree'), data, 0);
    loadToCurrentSelectedContainer(function() {
        qtest.hideLoading(btn);
        if (-1 === currentSelectedNodeId) {
            try {
                var first = $j("#containerTree").find("div.content:first");
                if (first.length) {
                    $j("#containerTree").find("div.content:first").trigger('click');
                } else {
                    throw "no container";
                }

            } catch (ex) {
                currentJSONContainer = {
                    selectedContainer: {
                        name: "",
                        dailyCreateTestSuite: $j("#createNewTestRun").prop("checked")
                    },
                    containerPath: []
                };
                if (Object.toJSON) {
                    // Prototype.js
                    document.querySelector("input[name='config.containerSetting']").value =  Object.toJSON(currentJSONContainer);
                } else {
                    // Standard
                    document.querySelector("input[name='config.containerSetting']").value =  JSON.stringify(currentJSONContainer);
                }
                $j("input[name='fakeContainerName']").val(currentJSONContainer.selectedContainer.name);
                $j("input[name='fakeContainerName']").trigger('change');
            }

        }
    });

  }, function () {
    qtest.hideLoading(btn);
  })
}

function loadRelease(data) {
  //load release
  var releases = [];
  if (data.releases && data.releases != "") {
    releases = data.releases;
  }
  bindRelease(releases);

  var selectedRelease = qtest.find(releases, "id", qtest.setting.release_id);
  if (!selectedRelease) {
    selectedRelease = releases.length > 0 ? releases[0] : null;
  }
  if (selectedRelease)
    qtest.selectizeRelease.setValue(selectedRelease.id);
}

function loadEnvironment(data) {
  //load environment
  var environments = [];
  var fieldIsInActive = false;
  var hasInActiveValue = false;
  if (data.environments && data.environments != "") {
    fieldIsInActive = data.environments.is_active ? false : true;
    if (!fieldIsInActive) {
      //get allowed_values
      $j.each(data.environments.allowed_values, function (index) {
        var item = data.environments.allowed_values[index];
        if (item.is_active) {
          item.field_id = data.environments.id;
          environments.push(item);
        } else {
          hasInActiveValue = true;
        }
      });
    }
    if (environments.length > 0)
      hasInActiveValue = false;
  }
  var show = fieldIsInActive || hasInActiveValue || environments.length <= 0;
  $j("span[class='config.environmentName1']").attr('style', 'display:' + (show ? '' : 'none'));
  bindEnvironment(environments);

  var selectedEnvironment = qtest.find(environments, "value", qtest.setting.environment_id);
  if (selectedEnvironment)
    qtest.selectizeEnvironment.setValue(selectedEnvironment.value);
}

function buildTree(jItem, data, qTestParentId) {
    if (data && data.length > 0) {
        var ul = $j( "<ul></ul>" );
        data.forEach(function(element) {
            var li = $j( "<li></li>" );
            var divItemContainer = $j("<div class='item-container'></div>");
            var divMainItem = $j("<div class='main-item'></div>");
            var divSubItems = $j("<div class='sub-item' style='display: none;'></div>");
            divItemContainer.append(divMainItem);
            divItemContainer.append(divSubItems);

            if (element.type !== 'test-suite') {
                divMainItem.append("<span class='collapse-indicator' style='align-self: center;'></span>");
            } else {
                divMainItem.append("<span class='empty-indicator'></span>");
            }

            var icon = $j("<span></span>")
            icon.addClass(element.type + "-icon");
            divMainItem.append(icon);

//            var aLink = $j("<a target='_blank' style='padding:0px 3px;'></a>")
//            aLink.attr("href", element.web_url)
//            aLink.text(element.pid);
//            divMainItem.append(aLink);
            var parentWidth = $j('#containerTree').width();
            var divContent = $j("<div class='content'></div>");
            divContent.width(parentWidth - 15);
            divContent.attr("title", (element.pid || "").toUpperCase() + " " + element.name)
            divContent.text((element.pid || "").toUpperCase() + " " + element.name);
            divContent.attr("qtestid", element.id);
            divContent.attr("qtesttype", element.type);
            divContent.attr("qtestparentid", qTestParentId);

            divMainItem.append(divContent);
            ul.append(li.append(divItemContainer));
        });
        var mainDiv = $j("<div></div>");
        mainDiv.append(ul);
        jItem.append(mainDiv);
    }

}
function loadContainers(jParentNode, data, qTestParentId) {
    var releases = data.releases || [];
    var testCycles = data.testCycles || [];
    var testSuites = data.testSuites || [];
    releases.forEach(function (e) {
        e.type = 'release';
    });

    testCycles.forEach(function (e) {
        e.type = 'test-cycle';
    });

    testSuites.forEach(function (e) {
        e.type = 'test-suite';
    });

    var items = releases;
    items = items.concat(testCycles);
    items = items.concat(testSuites);
    buildTree(jParentNode, items, qTestParentId);
    return items.length

}

function updateSelectedContainer(htmlSelectedItem) {
    var nodeId = undefined;
    var nodeType = undefined;
    var parentId = undefined;
    var itemName = "";
    initContainerJSON();
    if (htmlSelectedItem) {
        nodeId = +(htmlSelectedItem.getAttribute("qtestid"));
        nodeType = htmlSelectedItem.getAttribute("qtesttype");
        parentId = +(htmlSelectedItem.getAttribute("qtestparentid"));
        itemName = htmlSelectedItem.textContent || "";
        currentJSONContainer.selectedContainer.name = itemName;
        currentJSONContainer.containerPath = [];
        currentJSONContainer.containerPath.unshift({
            nodeId: nodeId,
            parentId: parentId,
            nodeType: nodeType
        });
        while(parentId !== 0) {
            var parent = document.querySelector("div[qtestid='" + parentId + "']");
            if (parent) {
                nodeId = +parent.getAttribute("qtestid");
                nodeType = parent.getAttribute("qtesttype");
                parentId = +parent.getAttribute("qtestparentid");
                currentJSONContainer.containerPath.unshift({
                    nodeId: nodeId,
                    parentId: parentId,
                    nodeType: nodeType
                })
            }
        }
    }

    if (Object.toJSON) {
        // Prototype.js
        document.querySelector("input[name='config.containerSetting']").value =  Object.toJSON(currentJSONContainer);
    } else {
        // Standard
        document.querySelector("input[name='config.containerSetting']").value =  JSON.stringify(currentJSONContainer);
    }
    $j("input[name='fakeContainerName']").val(itemName);
    $j("input[name='fakeContainerName']").trigger('change');
}

function loadToCurrentSelectedContainer(callback) {
    currentJSONContainer.containerPath = currentJSONContainer.containerPath || [];
    var len = currentJSONContainer.containerPath.length;
    var simulateClick = function(itemList, index, cb) {
        if (index === len - 1) {
            cb(true);
            return;
        }
        var element = itemList[index];
        var htmlNode = document.querySelector("div[qtestid='" + element.nodeId + "']");
        if (htmlNode) {
            var firstChild = htmlNode.parentElement.firstElementChild;
            if (firstChild) {
                $j(firstChild).trigger("click");
                // wait for sub-items completely loaded
                var tryCount = 5000;
                var interval = setInterval(function() {
                    if ($j(htmlNode.parentElement.nextElementSibling).is(":visible")) {
                        clearInterval(interval);
                        simulateClick(itemList, ++index, cb);
                    } else {
                        tryCount --;
                        if (0 >= tryCount) {
                            clearInterval(interval);
                            cb(false);
                            return;
                        }
                        // check timeout
                        // could not load sub-items
                    }
                }, 1000);

            }
        } else {
            cb(false);
        }
    }
    if (0 < len) {
        var htmlNode = undefined;
        simulateClick(currentJSONContainer.containerPath, 0, function(ret) {
            if (ret) {
                htmlNode = document.querySelector("div[qtestid='" +currentJSONContainer.containerPath[len-1].nodeId + "']");
                if (htmlNode) {
                    $j(htmlNode).trigger("click");
                }
            }
            // high lighted selected item if any;
            updateSelectedContainer(htmlNode);
            callback();
        });
    } else {
        // high lighted selected item if any;
        updateSelectedContainer(htmlNode);
        callback();
    }
}

function initContainerJSON() {
    var jsonString = document.querySelector("input[name='config.containerSetting']").value;
    if (jsonString && jsonString.length > 0) {
        var temp = undefined;
        try {
            temp = JSON.parse(jsonString);
            if (0 < Object.keys(temp).length) {
                // Check if temp.containerPath is now an object
                if (typeof temp.containerPath === 'object' && temp.containerPath !== null) {
                    // Convert the object to a JSON string
                    temp.containerPath = JSON.stringify(temp.containerPath);
                } else {
                    console.error("Failed to parse 'containerPath' as an object.");
                    // Handle the situation where parsing fails
                    temp.containerPath = "[]"; // or some default value
                }
                temp.containerPath = JSON.parse(temp.containerPath || "[]");
            } else {
                temp = undefined;
            }
        } catch (ex) {
            console.error(ex);
        }
        if (temp) {
            currentJSONContainer = temp;
        }
        temp = undefined;
    }
}