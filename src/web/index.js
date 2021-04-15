(function ($) {

    // Status messages
    //*********************************************************** */

    const statuses = {
        LOADING_DATA: 'Loading...',
        COMPLETE: ''
    };


    // Inizialization
    //*********************************************************** */

    let $status = document.getElementById('status');
    let $databaseName = document.getElementById('databaseName');
    let $rowsCount = document.getElementById('rowsCount');
    let $tablesCount = document.getElementById('tablesCount');
    let $columnsCount = document.getElementById('columnsCount');
    let $valuesCount = document.getElementById('valuesCount');
    let $txtFilter = $('#txtFilter');
    let $loading = $('#loading');
    let $loadingOverlay = $('#loadingOverlay');
    let $overlay = $('#overlay');

    $autofilter = $('#autofilter')
        .click(autoFilterClicked);
    $('#btnApplyFilter').click(btnApplyFilterClicked);
    $('#btnRemoveFilter').click(btnRemoveFilterClicked);
    $txtFilter
        .keyup(txtFilterChanged)
        .click(txtFilterClicked);


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

    window.addEventListener('message', (e) => {
        if (e && e.data) {

            setStatus(e.data.status);

            if (e.data.viewModel) {
                applyViewModel(e.data.viewModel);
            }
            else  {
                if (e.data.databaseName != undefined) {
                    $databaseName.innerText = e.data.databaseName;
                }                
                if (e.data.tables != undefined) {
                    renderTables(e.data.tables);
                }
                if (e.data.columns != undefined) {
                    renderColumns(e.data.columns);
                }
                if (e.data.values != undefined) {
                    renderValues(e.data.values, e.data.column);
                }
                if (e.data.rows != undefined) {
                    renderRows(e.data.rowsHeader, e.data.rows, e.data.count);
                }    
            }

            hideLoading();
        }
    }, false);


    // Utilities
    //*********************************************************** */

    function setStatus(status) {
        if (status) {
            const newStatus = statuses[status];
            $status.innerText = newStatus ? newStatus : '';
        }
        $status.innerText = '';
    }


    let loadingTimer = undefined;


    function showLoading() {
        $loadingOverlay.show();
        if (loadingTimer == undefined) {
            loadingTimer = setTimeout(() => {
                $loading.show();
            },
                300);
        }
    }


    function hideLoading() {
        if (loadingTimer) {
            clearTimeout(loadingTimer);
            loadingTimer = undefined;
        }
        $loadingOverlay.hide();
        $loading.hide();
    }


    function setFocus(selector) {
        $('.focused').removeClass('focused');
        $(selector).addClass('focused');
    }


    // ViewModel
    //*********************************************************** */

    let _columns;
    let _selectedTable;
    let _selectedColumn;
    let _selectedValue;
    let _selectedRow;


    function applyViewModel(vm) {

        if ('columns' in vm) _columns = vm.columns;

        _selectedTable = vm.selectedTable;
        _selectedColumn = vm.selectedColumn;
        _selectedValue = vm.selectedValue;
        _selectedRow = vm.selectedRow;

        if (vm.databaseName != undefined) {
            $databaseName.innerText = vm.databaseName;
        }

        if (vm.tables != undefined) {
            renderTables(vm.tables, vm.selectedTableIndex);
        }
        else {
            sendMessage({
                'command': 'loadTables'
            });
        }
        
        if (vm.columns != undefined) {
            renderColumns(vm.columns, vm.selectedColumnIndex);
        }
        
        if (vm.values != undefined) {
            renderValues(vm.values, _selectedColumn, vm.selectedValueIndex);
        }
        
        if (vm.rows != undefined) {
            renderRows(
                vm.rowsHeader, vm.rows, vm.rowsCount, 
                vm.selectedRowRowIndex, vm.selectedRowColumnIndex
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
    };


    function renderTables(tables, selectedIndex) {
        $tablesCount.innerText = `(${tables.length})`;
        renderCollection(tables,
            $('#tables .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1">Name</div>
                    <div class="col2">Schema</div>
                </div>`),
            (table) =>
                $(`<div class="table-data">
                    <div class="col1"><i class="ms-Icon ms-Icon--Table"></i> ${table.Name}</div>
                    <div class="col2">${table.Schema}</div>
                </div>`)
                    .click(tableClicked),
            selectedIndex
        );
    };


    function renderColumns(columns, selectedIndex) {
        _columns = [...columns];
        $columnsCount.innerText = `(${columns.length})`;
        renderCollection(columns,
            $('#columns .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1">Name</div>
                    <div class="col2">Type</div>
                </div>`),
            (column) =>
                $(`<div class="table-data">
                    <div class="col1"><i class="ms-Icon ms-Icon--Column"></i> ${column.Name}</div>
                    <div class="col2">${column.Type}</div>
                </div>`)
                    .click(columnClicked),
            selectedIndex
        );
    };


    function renderValues(values, column, selectedIndex) {
        $valuesCount.innerText = values && values.length ? `(${values.length})` : '';
        renderCollection(values,
            $('#values .table'),
            null, // no header
            (value) => {
                let element = $(`<div class="table-data"></div>`)
                    .click(valueClicked)
                    .dblclick(valueDblClicked);

                $(`<div class="col"></div>`)
                    .text(
                        value == null ? '[NULL]' : 
                        value == '' ? '[Empty string]' :
                        value == 0 && column.Type == 'bit' ? 'False' :
                        value == 1 && column.Type == 'bit' ? 'True' :
                        value)
                    .appendTo(element);
                
                return element;
            },
            selectedIndex
        );
    };


    function renderRows(rowsHeader, rows, rowsCount, selectedRowIndex, selectedColumnIndex) {
        $rowsCount.innerText = rowsCount ? `(${rowsCount})` : '';

        renderCollection(rows,
            $('#dataRows .table'),
            () => {
                let header = $(`<div class="table-header"></div>`);
                rowsHeader.forEach(name => {
                    header.append(`<div class="col">${name}</div>`);
                });
                return header;
            },
            (row, rowIndex) => {
                let element = $(`<div class="table-data"></div>`)
                    .click(rowClicked)
                    .dblclick(rowDblClicked);

                row.Values.forEach((value, index) => {
                    $(`<div class="col"></div>`)
                        .toggleClass('cell-selected', rowIndex == selectedRowIndex && index == selectedColumnIndex)
                        .text(value == null ? 'NULL' : value)
                        .data('cell-value', value)
                        .data('cell-index', index)
                        .click(rowCellClicked)
                        .appendTo(element);
                });
                return element;
            },
            selectedRowIndex
        );
    };


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


    function tableClicked() {
        setFocus('#tables');
        $('#tables .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedTable = selectedItem.data('item');
        showLoading();
        updateViewModel({
            'selectedTableIndex': selectedItem.data('item-index'),
            'selectedColumnIndex': null,
            'selectedValueIndex': null,
            'selectedRowRowIndex': null,
            'selectedRowColumnIndex': null
        });
        sendMessage({
            'command': 'loadColumns'
        });
        sendMessage({
            'command': 'loadRows'
        });
        renderValues([]);
        textToCopy = `[${_selectedTable.Schema}].[${_selectedTable.Name}]`;
    }


    function columnClicked() {
        setFocus('#columns');
        $('#columns .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedColumn = selectedItem.data('item');
        showLoading();
        updateViewModel({
            'selectedColumnIndex': selectedItem.data('item-index'),
            'selectedValueIndex': null
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
        _selectedValue = selectedItem.data('item');
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
        for (let i = 0; i < _columns.length; i++) {
            data.push([_columns[i].Name, row.Values[i]]);
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
            'filter': '',
            'selectedValueIndex': null,
            'selectedRowRowIndex': null,
            'selectedRowColumnIndex': null
        });
        if ($autofilter.get(0).checked) {
            applyFilter();
        }
    }


    function applyFilter() {
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
        sendMessage({
            'command': 'loadRows'
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
        $('#dialogViewRecord .header span').text(`[${_selectedTable.Schema}].[${_selectedTable.Name}]`);
        renderCollection(data,
            $('#dialogViewRecord .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1">Column</div>
                    <div class="col2">Value</div>
                </div>`),
            (row) => {
                let element = 
                    $(`<div class="table-data">
                        <div class="col1">${row[0]}</div>
                    </div>`)
                        .data('cell-value', row[1])
                        .click(detailRowClicked);

                $(`<div class="col2"></div>`)
                    .text(row[1] == null ? 'NULL' : row[1])
                    .appendTo(element);

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
                        val = "N'" + val + "'";
                        break;
                    }
                case "datetime":
                case "smalldatetime":
                    {
                        val = "'" + val + "'";
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