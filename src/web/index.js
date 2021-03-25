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
                sendMessage({
                    'command': 'copyText',
                    'item': textToCopy == null ? 'NULL' : textToCopy
                });
            }
        });
    });


    // Message handler
    //*********************************************************** */

    window.addEventListener('message', (e) => {
        if (e.data) {
            if (e.data.databaseName) {
                $databaseName.innerText = e.data.databaseName;
            }

            setStatus(e.data.status);
            //showErrors(e.data);

            renderTables(e.data.tables);
            renderColumns(e.data.columns);
            renderValues(e.data.values);

            if (e.data.rowsHeader != undefined) {
                renderRows(e.data.rowsHeader, e.data.rows, e.data.count);
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


    // Renders
    //*********************************************************** */

    function renderCollection(collection, $container, $headerFunc, $elementFunc) {
        let items = [];
        if ($headerFunc != undefined) {
            items.push($headerFunc(collection));
        }
        collection.forEach(collectionItem => {
            items.push(
                $elementFunc(collectionItem).data('item', collectionItem)
            );
        });
        $container.empty().append(items);
    };


    function renderTables(tables) {
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
                        .click(tableClicked)
            );
        }
    };


    function renderColumns(columns) {
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
                        .click(columnClicked)
            );
        }
    };


    function renderValues(values) {
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
                        .text(value == null ? '[NULL]' : value)
                        .appendTo(element);

                    return element;
                }
            );
        }
    };


    function renderRows(rowsHeader, rows, rowsCount) {
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

                row.forEach(value => {
                    $(`<div class="col"></div>`)
                        .text(value == null ? 'NULL' : value)
                        .data('cell-value', value)
                        .click(rowCellClicked)
                        .appendTo(element);
                });
                return element;
            }
        );
    };


    // Event handlers
    //*********************************************************** */

    let selectedTable;
    let selectedColumn;
    let selectedValue;


    function tableClicked() {
        setFocus('#tables');
        $('#tables .table .selected').removeClass('selected');
        selectedTable = $(this).addClass('selected').data('item');
        showLoading();
        sendMessage({
            'command': 'selectedTable',
            'item': selectedTable
        });
        sendMessage({
            'command': 'loadColumns',
            'item': selectedTable
        });
        sendMessage({
            'command': 'loadRows',
            'item': selectedTable
        });
        renderValues([]);
        textToCopy = `[${selectedTable.Schema}].[${selectedTable.Name}]`;
    }


    function columnClicked() {
        setFocus('#columns');
        $('#columns .table .selected').removeClass('selected');
        selectedColumn = $(this).addClass('selected').data('item');
        showLoading();
        sendMessage({
            'command': 'selectedColumn',
            'item': selectedColumn
        });
        sendMessage({
            'command': 'loadValues',
            'item': selectedColumn
        });
        textToCopy = `[${selectedColumn.Name}]`;
    }


    function valueClicked() {
        setFocus('#values');
        $('#values .table .selected').removeClass('selected');
        selectedValue = $(this).addClass('selected').data('item');
        textToCopy = selectedValue;
    }


    function valueDblClicked() {
        AddFilter('AND');
    }


    function rowClicked() {
        setFocus('#dataRows');
        $('#dataRows .table .selected').removeClass('selected');
        $(this).addClass('selected');
    }


    function rowCellClicked() {
        $('#dataRows .table .cell-selected').removeClass('cell-selected');
        let cellValue = $(this).addClass('cell-selected').data('cell-value');
        textToCopy = cellValue;
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
            sendMessage({
                'command': 'loadValues',
                'item': selectedColumn
            });
        }
        sendMessage({
            'command': 'loadRows',
            'item': selectedTable
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
                    .text(row[1])
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
            switch (selectedColumn.Type) {
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