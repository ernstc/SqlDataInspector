(function ($) {

    // Inizialization
    //*********************************************************** */

    let $databaseName = document.getElementById('databaseName');
    let $rowsCount = document.getElementById('rowsCount');
    let $tablesCount = document.getElementById('tablesCount');
    let $viewsCount = document.getElementById('viewsCount');
    let $columnsCount = document.getElementById('columnsCount');
    let $valuesCount = document.getElementById('valuesCount');
    let $cbTables = $('#cbTables');
    let $cbViews = $('#cbViews');
    let $txtFilter = $('#txtFilter');
    let $loading = $('#loading');
    let $loadingOverlay = $('#loadingOverlay');
    let $overlay = $('#overlay');
    let $liveMonitoringDiv = $('#liveMonitoring');
    let $liveMonitoring = $('#liveMonitoring input');
    let $refreshTimerDiv = $('#refreshTimer');
    let $refreshTimer = $('#refreshTimer select');
    let $objectFilters = $('#objectFilters');
    let $objectSchemaFilter = $('#objectFilters select');

    $autofilter = $('#autofilter')
        .click(autoFilterClicked);
    $('#btnApplyFilter')
        .click(btnApplyFilterClicked);
    $('#btnRemoveFilter')
        .click(btnRemoveFilterClicked);
    $txtFilter
        .keyup(txtFilterChanged)
        .click(txtFilterClicked);
    $liveMonitoring
        .click(setLiveMonitoring);
    $refreshTimer
        .change(setRefreshTimer);
    $objectSchemaFilter
        .change(setObjectsSchemaFilter);
    $cbTables
        .change(objectsChanged);
    $cbViews
        .change(objectsChanged);

    // VSCode API for interacting with the extension back-end
    //*********************************************************** */

    let vscode;

    try {
        vscode = acquireVsCodeApi();
        if (vscode == undefined) {
            //showError("vscode API is undefined");
        }
    }
    catch (e) {
        //showError("error while acquireVsCodeApi() - " + e);
    }


    function sendMessage(message) {
        if (vscode != undefined && message != undefined) {
            vscode.postMessage(message);
        }
    }


    function updateViewModel(vm) {
        sendMessage({
            'command': 'viewUpdated',
            'viewModel': vm
        });
    }


    // Clipboard handler
    //*********************************************************** */

    let textToCopy;

    $(document).ready(function() {
        var ctrlDown = false,
            ctrlKey = 17,
            cmdKey = 91,
            vKey = 86,
            cKey = 67;
    
        $(document).keydown(function(e) {
            if (e.keyCode == ctrlKey || e.keyCode == cmdKey) ctrlDown = true;
        }).keyup(function(e) {
            if (e.keyCode == ctrlKey || e.keyCode == cmdKey) ctrlDown = false;
        });
    
        $(".no-copy-paste").keydown(function(e) {
            if (ctrlDown && (e.keyCode == vKey || e.keyCode == cKey)) return false;
        });
        
        // Document Ctrl + C/V 
        $(document).keydown(function(e) {
            if (ctrlDown && (e.keyCode == cKey)) {
                // Document catch Ctrl+C

                let isTxtFilterFocused = $txtFilter.hasClass('focused');

                if (isTxtFilterFocused) {
                    var textArea = $txtFilter.get(0);
                    var text =textArea.value;
                    var indexStart=textArea.selectionStart;
                    var indexEnd=textArea.selectionEnd;
                    textToCopy = text.substring(indexStart, indexEnd);
                }

                sendMessage({
                    'command': 'copyText',
                    'item': textToCopy == null ? 'NULL' : textToCopy
                });
            }
        });

        sendMessage({
            'command': 'viewIsReady'
        });
    });



    // Message handler
    //*********************************************************** */

    window.addEventListener('message', async (e) => {
        if (e && e.data) {

            console.log(JSON.stringify(e.data));

            if (e.data.viewModel) {
                applyViewModel(e.data.viewModel);
                hideLoading();
            }
            else  {
                if (e.data.databaseName != undefined) {
                    $databaseName.innerText = e.data.databaseName;
                }                
                if (e.data.objects != undefined) {
                    renderObjects(e.data.objects);
                    hideLoading();
                }
                if (e.data.objectsSchema != undefined) {
                    renderObjectsSchemaFilter(e.data.objectsSchema, e.data.filterObjectsSchema);
                    hideLoading();
                }
                if (e.data.columns != undefined) {
                    await renderColumns(e.data.columns);
                    hideLoading();
                }
                if (e.data.values != undefined) {
                    renderValues(e.data.values, e.data.column, undefined, e.data.sortAscendingColumnValues, e.data.sortAscendingColumnValuesCount);
                    hideLoading();
                }
                if (e.data.rows != undefined) {
                    renderRows(e.data.rowsColumnsName, e.data.rows, e.data.rowsCount, null, null, e.data.objectIndex);
                    hideLoading();
                }
                if (e.data.object != undefined && e.data.objectIndex != undefined) {
                    $('#objects .table-data .col3').eq(e.data.objectIndex).text(e.data.object.Count);
                }
            }
        }
    }, false);


    // Utilities
    //*********************************************************** */

    let loadingTimer = undefined;
    let loadingCounters = 0;


    function showLoading(operationsCount = 1) {
        loadingCounters += operationsCount;
        $loadingOverlay.show();
        if (loadingTimer == undefined) {
            loadingTimer = setTimeout(() => {
                $loading.show();
            },
            300);
        }
    }


    function hideLoading() {
        loadingCounters--;
        if (loadingCounters < 0) loadingCounters = 0;
        if (loadingCounters == 0)
        {
            if (loadingTimer) {
                clearTimeout(loadingTimer);
                loadingTimer = undefined;
            }
            $loadingOverlay.hide();
            $loading.hide();
        }
    }


    function setFocus(selector) {
        $('.focused').removeClass('focused');
        $(selector).addClass('focused');
    }


    // ViewModel
    //*********************************************************** */

    let _columns;
    let _rowsColumns;
    let _selectedObject;
    let _selectedColumn;
    let _selectedValue;
    let _selectedRow;


    async function applyViewModel(vm) {

        if ('columns' in vm) _columns = vm.columns;

        _selectedObject = vm.selectedObject;
        _selectedColumn = vm.selectedColumn;
        _selectedValue = vm.selectedValue;
        _selectedRow = vm.selectedRow;

        if (vm.databaseName != undefined) {
            $databaseName.innerText = vm.databaseName;
        }

        $cbTables.get(0).checked = vm.selectTables == true;
        $cbViews.get(0).checked = vm.selectViews == true;
        
        if (vm.objects != undefined) {
            renderObjects(vm.objects, vm.selectedObjectIndex);
        }
        else {
            showLoading();
            sendMessage({
                'command': 'loadObjects'
            });
        }
        
        if (vm.columns != undefined) {
            await renderColumns(vm.columns, vm.selectedColumnIndex);
        }
        
        if (vm.values != undefined) {
            renderValues(vm.values, _selectedColumn, vm.selectedValueIndex, vm.sortAscendingColumnValues, vm.sortAscendingColumnValuesCount);
        }
        
        if (vm.rows != undefined) {
            renderRows(
                vm.rowsColumnsName, vm.rows, vm.rowsCount, 
                vm.selectedRowRowIndex, vm.selectedRowColumnIndex,
                vm.selectedObjectIndex
                );
        }
        
        if (vm.filter != undefined) {
            $txtFilter.val(vm.filter);
        }
        
        if (vm.autoApply != undefined) {
            $autofilter.get(0).checked = vm.autoApply;
        }

        if (vm.showRecordDetails && _selectedRow && _columns) {
            showDatabaseTableRow(_selectedRow);
        }

        if (vm.objectsSchema) {
            renderObjectsSchemaFilter(vm.objectsSchema, vm.filterObjectsSchema);
        }

        $liveMonitoring.get(0).checked = vm.liveMonitoring == true;
        $refreshTimer.val(vm.refreshTimer != undefined ? vm.refreshTimer : 30);

        setLiveMonitoring();
    }


    // Renders
    //*********************************************************** */

    function renderCollection(collection, $container, $headerFunc, $elementFunc, selectedIndex) {
        let items = [];
        if ($headerFunc != undefined && collection.length > 0) {
            items.push($headerFunc(collection));
        }
        collection.forEach((collectionItem, index) => {
            items.push(
                $elementFunc(collectionItem, index)
                    .data('item', collectionItem)
                    .data('item-index', index)
                    .toggleClass('selected', selectedIndex == index)
            );
        });
        $container.empty().append(items);
    }


    function renderValue(value, columnType) {
        return value == null ? '[NULL]' : 
               value == '' ? '[Empty string]' :
               value == 0 && columnType == 'bit' ? 'False' :
               value == 1 && columnType == 'bit' ? 'True' :
               value;
    }


    function renderObjects(objects, selectedIndex) {
        let tablesCount = objects.filter(o => o.ObjectType == 0).length;
        let viewsCount = objects.filter(o => o.ObjectType == 1).length
        $tablesCount.innerText = $cbTables.get(0).checked ? `(${tablesCount})` : '';
        $viewsCount.innerText = $cbViews.get(0).checked ? `(${viewsCount})` : '';
        renderCollection(objects,
            $('#objects .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1">Name</div>
                    <div class="col2">Schema</div>
                    <div class="col3">Count</div>
                </div>`),
            (object) =>
                $(`<div class="table-data"></div>`)
                    .append(
                        $('<div class="col1"></div>')
                            .attr('title', object.Name)
                            .append(`<i class="ms-Icon ms-Icon--${object.ObjectType == 1 ? 'DatabaseView' : 'Table'}"></i>`)
                            .append('&nbsp;')
                            .append($('<span></span>').text(object.Name))
                    )
                    .append(
                        $('<div class="col2"></div>')
                            .attr('title', object.Schema)
                            .text(object.Schema)
                    )
                    .append(
                        $('<div class="col3"></div>')
                            .text(object.Count == undefined ? '' : object.Count)
                    )
                    .click(objectClicked),
            selectedIndex
        );
    }


    function renderObjectsSchemaFilter(objectsSchema, filterValue) {
        if (filterValue == undefined) {
            filterValue = $objectSchemaFilter.val();
        }
        else if (objectsSchema.indexOf(filterValue) < 0) {
            objectsSchema.unshift(filterValue);
        }

        filterValue = filterValue || '*';
        $objectFilters.toggleClass('schema', filterValue != '*');

        $objectSchemaFilter.empty().append('<option value="*"> </option>');
        for (let i = 0; i < objectsSchema.length; i++) {
            $objectSchemaFilter.append(
                $(`<option></option>`)
                    .attr('value', objectsSchema[i])
                    .text(objectsSchema[i])
            );
        }
        $objectSchemaFilter.val(filterValue);
    }


    async function renderColumns(columns, selectedIndex) {
        _columns = columns;
        $columnsCount.innerText = _selectedObject != undefined ? `(${columns.length})` : '';
        renderCollection(columns,
            $('#columns .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1">Name</div>
                    <div class="col2">Type</div>
                </div>`),
            (column) =>
                $(`<div class="table-data"></div>`)
                    .append(
                        $('<div class="col1"></div>')
                            .attr('title', column.Name)
                            .append('<i class="ms-Icon ms-Icon--Column"></i>')
                            .append('&nbsp;')
                            .append($('<span></span>').text(column.Name))
                    )
                    .append(
                        $('<div class="col2"></div>')
                            .attr('title', column.Type)
                            .text(column.Type)
                    )
                    .click(columnClicked),
            selectedIndex
        );
    }


    function renderValues(values, column, selectedIndex, sortAscendingValues, sortAscendingValuesCount) {
        $valuesCount.innerText = values && values.length ? `(${values.length})` : '';
        let $table;
        renderCollection(values,
            $table = $('#values .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1 sortable" data-column="values" data-sort="ascending" data-sort-default="">Value</div>
                    <div class="col2 sortable" data-column="counts" data-sort="" data-sort-default="ascending">Count</div>
                </div>`),
            (value) => {
                let element = $(`<div class="table-data"></div>`)
                    .click(valueClicked)
                    .dblclick(valueDblClicked);

                $(`<div class="col1"></div>`)
                    .text(renderValue(value.Value, column.Type))
                    .appendTo(element);

                $(`<div class="col2"></div>`)
                    .text(value.Count)
                    .appendTo(element);
                
                return element;
            },
            selectedIndex
        );
        setHeaderSorting($table.find('.table-header .col1').click(valuesHeaderClicked), sortAscendingValues);
        setHeaderSorting($table.find('.table-header .col2').click(valuesCountHeaderClicked), sortAscendingValuesCount);
    }


    function setHeaderSorting($header, sortAscending) {
        $header.find('i').remove();        
        if (sortAscending == true) {
            $header.data('sort', 'ascending').append('<i class="ms-Icon ms-Icon--CaretSolidUp"></i>');
        }
        else if (sortAscending == false) {
            $header.data('sort', '').append('<i class="ms-Icon ms-Icon--CaretSolidDown"></i>');
        }
        else {
            $header.data('sort', $header.data('sort-default'));
        }
    }


    function valuesHeaderClicked() {
        let $this = $(this);
        let sortAscending = $this.data('sort') != 'ascending';
        setHeaderSorting($('#values .table-header .col1'), sortAscending);
        setHeaderSorting($('#values .table-header .col2'), undefined);

        showLoading();
        updateViewModel({
            'sortAscendingColumnValues': sortAscending,
            'sortAscendingColumnValuesCount': null,
        });
        sendMessage({
            'command': 'loadValues'
        });
    }
    

    function valuesCountHeaderClicked() {
        let $this = $(this);
        let sortAscending = $this.data('sort') != 'ascending';
        setHeaderSorting($('#values .table-header .col1'), undefined);
        setHeaderSorting($('#values .table-header .col2'), sortAscending);

        showLoading();
        updateViewModel({
            'sortAscendingColumnValues': null,
            'sortAscendingColumnValuesCount': sortAscending,
        });
        sendMessage({
            'command': 'loadValues'
        });
    }


    function renderRows(rowsColumnsName, rows, rowsCount, selectedRowIndex, selectedColumnIndex, objectIndex) {
        $rowsCount.innerText = 
            rows.length < rowsCount ? `(${rows.length} / ${rowsCount})` : 
            rowsCount ? `(${rowsCount})` : 
            '';

        _rowsColumns = [];
        rowsColumnsName.forEach(name => _rowsColumns.push(_columns.filter(c => c.Name == name)[0]));
        renderCollection(rows,
            $('#dataRows .table'),
            () => {
                let header = $(`<div class="table-header"></div>`);
                rowsColumnsName.forEach(name => {
                    header.append($(`<div class="col"></div>`).text(name));
                });
                return header;
            },
            (row, rowIndex) => {
                let element = $(`<div class="table-data"></div>`)
                    .click(rowClicked)
                    .dblclick(rowDblClicked);

                row.Values.forEach((value, index) => {
                    if (_rowsColumns[index] != null) {
                        $(`<div class="col"></div>`)
                            .toggleClass('cell-selected', rowIndex == selectedRowIndex && index == selectedColumnIndex)
                            .text(renderValue(value, _rowsColumns[index].Type))
                            .data('cell-value', value)
                            .data('cell-index', index)
                            .click(rowCellClicked)
                            .appendTo(element);
                    }
                });
                return element;
            },
            selectedRowIndex
        );
    }


    // Event handlers
    //*********************************************************** */

    function autoFilterClicked() {
        updateViewModel({
            'autoApply': $autofilter.get(0).checked
        });
    }


    function txtFilterChanged() {
        updateViewModel({
            'filter': $txtFilter.val()
        });
    }


    function txtFilterClicked() {
        setFocus('#txtFilter');
    }


    function objectClicked() {
        setFocus('#objects');
        $('#objects .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedObject = selectedItem.data('item');
        _selectedColumn = undefined;
        _selectedValue = undefined;
        _selectedRow = undefined;
        showLoading(2);
        updateViewModel({
            'selectedObjectIndex': selectedItem.data('item-index')
        });
        sendMessage({
            'command': 'loadColumns|loadRows'
        });
        renderValues([]);
        textToCopy = `[${_selectedObject.Schema}].[${_selectedObject.Name}]`;
    }


    function columnClicked() {
        setFocus('#columns');
        $('#columns .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedColumn = selectedItem.data('item');
        _selectedValue = undefined;
        showLoading();
        updateViewModel({
            'selectedColumnIndex': selectedItem.data('item-index'),
            'sortAscendingColumnValues': true,
            'sortAscendingColumnValuesCount': null,
        });
        sendMessage({
            'command': 'loadValues'
        });
        textToCopy = `[${_selectedColumn.Name}]`;
    }


    function valueClicked() {
        setFocus('#values');
        $('#values .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedValue = selectedItem.data('item').Value;
        textToCopy = _selectedValue;
        updateViewModel({
            'selectedValueIndex': selectedItem.data('item-index')
        });
    }


    function valueDblClicked() {
        AddFilter('AND');
    }


    function rowClicked() {
        setFocus('#dataRows');
        $('#dataRows .table .selected').removeClass('selected');
        $(this).addClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedRow = selectedItem.data('item');
        updateViewModel({
            'selectedRowRowIndex': selectedItem.data('item-index')
        });
    }


    function rowCellClicked() {
        $('#dataRows .table .cell-selected').removeClass('cell-selected');
        let cell = $(this).addClass('cell-selected');
        textToCopy = cell.data('cell-value');
        updateViewModel({
            'selectedRowColumnIndex': cell.data('cell-index')
        });
    }


    function rowDblClicked() {
        let row = $(this).data('item');
        showDatabaseTableRow(row);
    }


    function showDatabaseTableRow(row) {
        setFocus('#dialogViewRecord');
        let data = [];
        for (let i = 0; i < _rowsColumns.length; i++) {
            data.push([_rowsColumns[i], row.Values[i]]);
        }
        showDetailDialog(data);
    }


    function detailRowClicked() {
        $('#dialogViewRecord .table .selected').removeClass('selected');
        let cellValue = $(this).addClass('selected').data('cell-value');
        textToCopy = cellValue;
    }


    function btnApplyFilterClicked() {
        applyFilter();
    }


    function btnRemoveFilterClicked() {
        $txtFilter.val('');
        txtFilterChanged();
        updateViewModel({
            'filter': ''
        });
        if ($autofilter.get(0).checked) {
            applyFilter();
        }
    }


    function applyFilter() {
        _selectedValue = undefined;
        _selectedRow = undefined;
        updateViewModel({
            'selectedValueIndex': null,
            'selectedRowRowIndex': null,
            'selectedRowColumnIndex': null
        });
        if (_selectedColumn) {
            showLoading();
            sendMessage({
                'command': 'loadValues',
            });
        }
        showLoading();
        sendMessage({
            'command': 'loadRows'
        });
    }


    let liveMonitoringIntervalHandler = undefined;
    let isLiveMonitoringEnabled = false;
    const pauseBetweenCommands = 160;

    function setLiveMonitoring() {
        isLiveMonitoringEnabled = $liveMonitoring.get(0).checked;

        $liveMonitoringDiv.toggleClass('enabled', isLiveMonitoringEnabled);
        $refreshTimerDiv.toggle(isLiveMonitoringEnabled);

        let timerValue = parseInt($refreshTimer.val(), 10);

        updateViewModel({
            'liveMonitoring': isLiveMonitoringEnabled,
            'refreshTimer': timerValue
        });

        if (!isLiveMonitoringEnabled)
        {
            if (liveMonitoringIntervalHandler != undefined) {
                clearInterval(liveMonitoringIntervalHandler);
                liveMonitoringIntervalHandler = undefined;
            }
        }
        else if (liveMonitoringIntervalHandler == undefined) {
            
            let refreshFunc = () => {
                let tables = $('#objects .table-data');
                let tasks = [];

                for (let index = 0; index < tables.length; index++)
                {
                    let item = tables.eq(index).data('item');
                    tasks.push({
                        'item': item,
                        'message': {
                            'command': 'loadRowsCount',
                            'index': index
                        }
                    });
                }

                if (_selectedObject != undefined) {
                    tasks.push({
                        'message': {
                            'command': 'loadRows'
                        }
                    });
                }

                if (_selectedColumn != undefined) {
                    tasks.push({
                        'message': {
                            'command': 'loadValues'
                        }
                    });
                }

                let idx = 0;
                let execMessagesFunc = () => {
                    if (isLiveMonitoringEnabled && idx < tasks.length) {

                        let task = tasks[idx];

                        if (task.item != undefined) {
                            let currentTable = $('#objects .table-data').eq(idx).data('item');
                            if (
                                currentTable == undefined 
                                || (currentTable.Name != task.item.Name && currentTable.Schema != task.item.Schema)
                            ) {
                                idx++;
                                setTimeout(() => {
                                    execMessagesFunc();
                                }, 10);
                                return;
                            }
                        }

                        idx++;
                        sendMessage(task.message);
                        setTimeout(() => {
                            execMessagesFunc();
                        }, pauseBetweenCommands);
                    }
                };
                execMessagesFunc();
            }

            let tables = $('#objects .table-data');
            let intervalTableMs = pauseBetweenCommands * (tables.length + 1) + 1000;

            refreshFunc();

            setTimeout(() => {
                if (liveMonitoringIntervalHandler != undefined) {
                    clearInterval(liveMonitoringIntervalHandler);
                    liveMonitoringIntervalHandler = undefined;
                }
                if (isLiveMonitoringEnabled) {
                    let tables = $('#objects .table-data');
                    let intervalTableMs = pauseBetweenCommands * (tables.length + 1) + 1000;
                    let intervalMs = timerValue * 1000;
                    if (intervalMs < intervalTableMs) {
                        intervalMs = intervalTableMs;
                    }
                    liveMonitoringIntervalHandler = setInterval(refreshFunc, intervalMs);
                }
            }, intervalTableMs);
        }
    }


    function setRefreshTimer() {
        if (liveMonitoringIntervalHandler != undefined) {
            clearInterval(liveMonitoringIntervalHandler);
            liveMonitoringIntervalHandler = undefined;
        }
        isLiveMonitoringEnabled = false;
        setTimeout(() => {
            setLiveMonitoring();    
        }, pauseBetweenCommands * 2);        
    }


    function setObjectsSchemaFilter() {
        var filterValue = $objectSchemaFilter.val();
        _selectedObject = undefined;
        _selectedColumn = undefined;
        _selectedValue = undefined;
        _selectedRow = undefined;

        renderColumns([]);
        renderValues([]);
        renderRows([], [], 0);
        textToCopy = ``;

        updateViewModel({
            'filterObjectsSchema': filterValue,
            'selectedObjectIndex': -1,
            'selectedColumnIndex': -1,
            'selectedRowRowIndex': -1,
            'selectedRowColumnIndex': -1,
            'selectedValueIndex': -1
        });
        $objectFilters.toggleClass('schema', filterValue != '*');
        showLoading(1);
        sendMessage({
            'command': 'loadObjects'
        });
    }


    function objectsChanged() {
        _selectedObject = undefined;
        _selectedColumn = undefined;
        _selectedValue = undefined;
        _selectedRow = undefined;

        renderColumns([]);
        renderValues([]);
        renderRows([], [], 0);
        textToCopy = ``;

        updateViewModel({
            'selectedObjectIndex': -1,
            'selectedColumnIndex': -1,
            'selectedRowRowIndex': -1,
            'selectedRowColumnIndex': -1,
            'selectedValueIndex': -1,
            'selectTables': $cbTables.get(0).checked,
            'selectViews': $cbViews.get(0).checked
        });
        showLoading(1);
        sendMessage({
            'command': 'loadObjects'
        });
    }


    // Dialogs
    //*********************************************************** */

    $('#dialogViewRecord .close').click(() => {
        setFocus('#dataRows');
        hideDetailDialog();        
    });


    function showDetailDialog(data) {
        textToCopy = undefined;
        $overlay.removeClass('hidden');
        $('#dialogViewRecord .header span').text(`[${_selectedObject.Schema}].[${_selectedObject.Name}]`);
        renderCollection(data,
            $('#dialogViewRecord .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1">Column</div>
                    <div class="col2">Value</div>
                </div>`),
            (row) => {
                let column = row[0];
                let value = row[1];
                let element = 
                    $(`<div class="table-data"></div>`)
                        .append(
                            $('<div class="col1"></div>')
                                .text(column.Name)
                        )
                        .append(
                            $(`<div class="col2"></div>`)
                                .text(renderValue(value, column.Type))
                        )
                        .data('cell-value', row[1])
                        .click(detailRowClicked);

                return element;
            }
        );
        $('#dialogViewRecord').removeClass('hidden');
        updateViewModel({
            'showRecordDetails': true
        });
    }


    function hideDetailDialog() {
        $overlay.addClass('hidden');
        $('#dialogViewRecord').addClass('hidden');

        updateViewModel({
            'showRecordDetails': false
        });
    }


    // Filter clause composition
    //*********************************************************** */

    function AddFilter(operand) {
        let filter = $txtFilter.val().trim();
        if (filter.length > 0) filter += " " + operand + " ";
        let val = _selectedValue;
        if (val == null || val == "[NULL]" || val == "[NOT NULL]") {
            filter += "([" + _selectedColumn.Name + "] IS " + ((val == null || val == "[NULL]") ? "NULL" : "NOT NULL") + ")";
        }
        else {
            let type = _selectedColumn.Type;
            if (type.indexOf(':') > 0) {
                type = type.split(':')[1];
            }

            switch (type) {
                case "uniqueidentifier":
                    {
                        val = "N'{" + val + "}'";
                        break;
                    }
                case "char":
                case "nchar":
                case "varchar":
                case "nvarchar":
                    {
                        val = "N'" + val.replace(/\'/g, "''") + "'";
                        break;
                    }
                case "date":
                case "datetime":
                case "datetime2":
                case "datetimeoffset":
                case "smalldatetime":
                case "time":
                    {
                        val = "'" + val + "'";
                        break;
                    }
                case "float":
                case "double":
                case "real":
                case "decimal":
                case "money":
                case "smallmoney":
                    {
                        val = val.replace(',', '.');
                        break;
                    }
                default:
                    {
                        break;
                    }
            };
            filter += "([" + _selectedColumn.Name + "] = " + val + ")";
        }
        $txtFilter.val(filter);
        txtFilterChanged();

        if ($autofilter.get(0).checked) {
            updateViewModel({
                'filter': filter
            });
            applyFilter();
        }
    }

})(jQuery);