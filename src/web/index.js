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

    $autofilter = document.getElementById('autofilter');
    $('#btnApplyFilter').click(btnApplyFilterClicked);
    $('#btnRemoveFilter').click(btnRemoveFilterClicked);
    $txtFilter.click(txtFilterClicked);


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

                console.log('text to copy = \'' + textToCopy + '\'');

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
        console.log('received message:');
        if (e && e.data) {

            console.log('... processing message');
            console.log(JSON.stringify(e.data));

            setStatus(e.data.status);

            if (e.data.viewModel) {
                applyViewModel(e.data.viewModel);
            }
            else  {
                if (e.data.databaseName) {
                    $databaseName.innerText = e.data.databaseName;
                }                
                renderTables(e.data.tables);
                renderColumns(e.data.columns, e.data.table);
                if (e.data.values) {
                    renderValues(e.data.values, e.data.column, e.data.table);
                }
                if (e.data.rows) {
                    renderRows(e.data.rowsHeader, e.data.rows, e.data.count, e.data.table);
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

    function applyViewModel(vm) {
        if (vm.databaseName != undefined) {
            $databaseName.innerText = vm.databaseName;
        }

        if (vm.tables != undefined) {
            renderTables(vm.tables, vm.selectedTableIndex);
        }
        else {
            sendMessage({
                'command': 'loadTables',
                'item': selectedTable
            });
        }
        
        if (vm.columns != undefined) {
            let selectedTable = vm.tables[vm.selectedTableIndex];
            renderColumns(vm.columns, selectedTable, vm.selectedColumnIndex);
        }
        
        if (vm.values != undefined) {
            let selectedTable = vm.tables[vm.selectedTableIndex];
            let selectedColumn = vm.columns[vm.selectedColumnIndex];            
            renderValues(vm.values, selectedColumn, selectedTable, vm.selectedValueIndex);
        }
        
        if (vm.rows != undefined) {
            let selectedTable = vm.tables[vm.selectedTableIndex];
            renderRows(
                vm.rowsHeader, vm.rows, vm.rowsCount, 
                selectedTable,
                vm.selectedRowRowIndex, vm.selectedRowColumnIndex
                );
        }
        
        if (vm.filter != undefined) {
            $txtFilter.val(vm.filter);
        }
        
        if (vm.autoApply != undefined) {
            $autofilter.get(0).checked = vm.autoApply;
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
                $elementFunc(collectionItem)
                    .data('item', collectionItem)
                    .data('item-index', index)
                    .toggleClass('selected', selectedIndex == index)
            );
        });
        $container.empty().append(items);
    };


    function renderTables(tables, selectedIndex) {
        if (tables) {
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
        }
    };


    function renderColumns(columns, table, selectedIndex) {
        if (columns) {
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
        }
    };


    function renderValues(values, column, table, selectedIndex) {
        $valuesCount.innerText = values && values.length ? `(${values.length})` : '';
        if (values) {
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
        }
    };


    function renderRows(rowsHeader, rows, rowsCount, table, selectedRowIndex, selectedColumnIndex) {
        $rowsCount.innerText = rowsCount;
        renderCollection(rows,
            $('#dataRows .table'),
            () => {
                let header = $(`<div class="table-header"></div>`);
                rowsHeader.forEach(name => {
                    header.append(`<div class="col">${name}</div>`);
                });
                return header;
            },
            (row) => {
                let element = $(`<div class="table-data"></div>`)
                    .data('columns', rowsHeader)
                    .click(rowClicked)
                    .dblclick(rowDblClicked);

                row.forEach((value, index) => {
                    $(`<div class="col"></div>`)
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

    let selectedTable;
    let selectedColumn;
    let selectedValue;
    let selectedRow;


    function txtFilterClicked() {
        setFocus('#txtFilter');
    }


    function tableClicked() {
        setFocus('#tables');
        $('#tables .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        selectedTable = selectedItem.data('item');
        showLoading();
        updateViewModel({
            'selectedTableIndex': selectedItem.data('item-index')
        });
        sendMessage({
            'command': 'loadColumns'
        });
        sendMessage({
            'command': 'loadRows'
        });
        renderValues([]);
        textToCopy = `[${selectedTable.Schema}].[${selectedTable.Name}]`;
    }


    function columnClicked() {
        setFocus('#columns');
        $('#columns .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        selectedColumn = selectedItem.data('item');
        showLoading();
        updateViewModel({
            'selectedColumnIndex': selectedItem.data('item-index')
        });
        sendMessage({
            'command': 'loadValues'
        });
        textToCopy = `[${selectedColumn.Name}]`;
    }


    function valueClicked() {
        setFocus('#values');
        $('#values .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        selectedValue = selectedItem.data('item');
        textToCopy = selectedValue;
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
        selectedRow = selectedItem.data('item');
        updateViewModel({
            'selectedRowRowIndex': selectedItem.data('item-index')
        });
    }


    function rowCellClicked() {
        $('#dataRows .table .cell-selected').removeClass('cell-selected');
        let cellValue = $(this).addClass('cell-selected').data('cell-value');
        textToCopy = cellValue;
        updateViewModel({
            'selectedRowColumnIndex': cellValue.data('cell-index')
        });
    }


    function rowDblClicked() {
        setFocus('#dialogViewRecord');
        let $this = $(this);
        let columns = $this.data('columns');
        let values = $this.data('item');

        let data = [];
        for (let i = 0; i < columns.length; i++) {
            data.push([columns[i], values[i]]);
        }

        showDetailDialog(data);
    }


    function detailRowClicked() {
        $('#dialogViewRecord .table .selected').removeClass('selected');
        let cellValue = $(this).addClass('selected').data('cell-value');
        textToCopy = cellValue;
    }


    function btnApplyFilterClicked() {
        sendMessage({
            'command': 'changedFilter',
            'item': $txtFilter.val()
        });
        applyFilter();
    }


    function btnRemoveFilterClicked() {
        $txtFilter.val('');
        sendMessage({
            'command': 'changedFilter',
            'item': ''
        });
        if ($autofilter.checked) {
            applyFilter();
        }
    }


    function applyFilter() {
        if (selectedColumn) {
            showLoading();
            sendMessage({
                'command': 'loadValues',
                'item': selectedColumn
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
        $('#dialogViewRecord .header span').text(`[${selectedTable.Schema}].[${selectedTable.Name}]`);
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
    }


    function hideDetailDialog() {
        $overlay.addClass('hidden');
        $('#dialogViewRecord').addClass('hidden');
    }


    // Filter clause composition
    //*********************************************************** */

    function AddFilter(operand) {
        let filter = $txtFilter.val().trim();
        if (filter.length > 0) filter += " " + operand + " ";
        let val = selectedValue;
        if (val == null || val == "[NULL]" || val == "[NOT NULL]") {
            filter += "([" + selectedColumn.Name + "] IS " + ((val == null || val == "[NULL]") ? "NULL" : "NOT NULL") + ")";
        }
        else {
            let type = selectedColumn.Type;
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
            filter += "([" + selectedColumn.Name + "] = " + val + ")";
        }
        $txtFilter.val(filter);

        if ($autofilter.checked) {
            sendMessage({
                'command': 'changedFilter',
                'item': filter
            });
            applyFilter();
        }
    }


})(jQuery);