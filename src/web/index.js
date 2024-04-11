(function ($) {

    // Inizialization
    //*********************************************************** */

    const $serverName = document.getElementById('serverName');
    const $databaseName = document.getElementById('databaseName');
    const $objectNamePart = $('#objectNamePart');
    const $objectName = document.getElementById('objectName');
    const $rowsCount = document.getElementById('rowsCount');
    const $tablesCount = document.getElementById('tablesCount');
    const $viewsCount = document.getElementById('viewsCount');
    const $columnsCount = document.getElementById('columnsCount');
    const $valuesCount = document.getElementById('valuesCount');
    const $cbTables = $('#cbTables');
    const $cbViews = $('#cbViews');
    const $txtFilter = $('#txtFilter');
    const $loading = $('#loading');
    const $loadingOverlay = $('#loadingOverlay');
    const $overlay = $('#overlay');
    const $liveMonitoringDiv = $('#liveMonitoring');
    const $liveMonitoring = $('#liveMonitoring input');
    const $refreshTimerDiv = $('#refreshTimer');
    const $refreshTimer = $('#refreshTimer select');
    const $objectSearch = $('#objectSearch');
    const $objectSearchInput = $('#objectSearch input');
    const $objectFilters = $('#objectFilters');
    const $objectSchemaFilter = $('#objectFilters select');
    const $rowsPageSize = $('#rowsPageSize select');
    const $rowsPager = $('#rowsPager');
    const $btnCopyValues = $('#btnCopyValues');
    const $filtersHeader = $('#filtersHeader');
    const $filters = $('#filters');

    $autofilter = $('#autofilter')
        .click(autoFilterClicked);
    $('#btnApplyFilter')
        .click(btnApplyFilterClicked);
    $('#btnRemoveFilter')
        .click(btnRemoveFilterClicked);
    $btnCopyValues
        .click(btnCopyValuesClicked);
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
    $rowsPageSize
        .change(setPageSize);
    $rowsPager.find('li')
        .click(btnPageClicked);
    $('#btnSearchObjects')
        .click(btnSearchObjectsClicked);
    $('#clearObjectSearch')
        .click(clearObjectSearchClicked);
    $objectSearchInput
        .keyup(objectSearchInputChanged);
    $filtersHeader
        .click(filtersHeaderClicked);


    // VSCode API for interacting with the extension back-end
    //*********************************************************** */

    let vscode;

    try {
        vscode = acquireVsCodeApi();
        if (vscode === undefined) {
            //showError("vscode API is undefined");
        }
    }
    catch (e) {
        //showError("error while acquireVsCodeApi() - " + e);
    }


    function sendMessage(message) {
        if (vscode !== undefined && message !== undefined) {
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

    $(document).ready(function () {
        var ctrlDown = false,
            ctrlKey = 17,
            cmdKey = 91,
            vKey = 86,
            cKey = 67;

        $(document).keydown(function (e) {
            if (e.keyCode === ctrlKey || e.keyCode === cmdKey) { ctrlDown = true; }
        }).keyup(function (e) {
            if (e.keyCode === ctrlKey || e.keyCode === cmdKey) { ctrlDown = false; }
        });

        $(".no-copy-paste").keydown(function (e) {
            if (ctrlDown && (e.keyCode === vKey || e.keyCode === cKey)) { return false; }
        });

        // Document Ctrl + C/V 
        $(document).keydown(function (e) {
            if (ctrlDown && (e.keyCode === cKey)) {
                // Document catch Ctrl+C

                let isTxtFilterFocused = $txtFilter.hasClass('focused');

                if (isTxtFilterFocused) {
                    var textArea = $txtFilter.get(0);
                    var text = textArea.value;
                    var indexStart = textArea.selectionStart;
                    var indexEnd = textArea.selectionEnd;
                    textToCopy = text.substring(indexStart, indexEnd);
                }

                sendMessage({
                    'command': 'copyText',
                    'item': textToCopy === null ? 'NULL' : textToCopy
                });
            }
        });

        sendMessage({
            'command': 'viewIsReady|databaseInfo'
        });

        document.oncontextmenu = document.body.oncontextmenu = function() { return false; }
    });


    // Database Info
    //*********************************************************** */

    let _databaseInfo = {
        Provider: '',
        NameEncloserStart: '', 
        NameEncloserEnd: '',
        Version: ''
    };


    // Message handler
    //*********************************************************** */

    window.addEventListener('message', async (e) => {
        if (e && e.data) {
            if (e.data.viewModel) {
                applyViewModel(e.data.viewModel);
                hideLoading();
            }
            else {
                if (e.data.databaseInfo !== undefined) {
                    _databaseInfo = e.data.databaseInfo;
                    console.log('Database: ', _databaseInfo);
                }
                if (e.data.serverName !== undefined) {
                    $serverName.innerText = e.data.serverName;
                }
                if (e.data.databaseName !== undefined) {
                    $databaseName.innerText = e.data.databaseName;
                }
                if (e.data.objects !== undefined) {
                    renderObjects(e.data.objects, e.data.objectIndex);
                    hideLoading();
                }
                if (e.data.objectsSchema !== undefined) {
                    renderObjectsSchemaFilter(e.data.objectsSchema, e.data.filterObjectsSchema);
                    hideLoading();
                }
                if (e.data.columns !== undefined) {
                    await renderColumns(e.data.columns, e.data.selectedColumnIndex, e.data.sortColumnNames);
                    hideLoading();
                }
                if (e.data.values !== undefined) {
                    _values = e.data.values;
                    _sortAscendingColumnValues = e.data.sortAscendingColumnValues;
                    _sortAscendingColumnValuesCount = e.data.sortAscendingColumnValuesCount;
                    renderValues(e.data.values, e.data.column, undefined, e.data.sortAscendingColumnValues, e.data.sortAscendingColumnValuesCount);
                    hideLoading();
                }
                if (e.data.rows !== undefined) {
                    renderRows(e.data.rowsColumnsName, e.data.rows, e.data.rowsCount, e.data.rowsPageIndex, null, null, e.data.objectIndex, e.data.sortRowsByColumnName, e.data.sortRowsByColumnAscending);
                    hideLoading();
                }
                if (e.data.object !== undefined && e.data.objectIndex !== undefined) {
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
        if (loadingTimer === undefined) {
            loadingTimer = setTimeout(() => {
                $loading.show();
            },
                300);
        }
    }


    function hideLoading() {
        loadingCounters--;
        if (loadingCounters < 0) { loadingCounters = 0; }
        if (loadingCounters === 0) {
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
    let _values;
    let _selectedValueIndex;
    let _sortAscendingColumnValues;
    let _sortAscendingColumnValuesCount;


    async function applyViewModel(vm) {

        if ('columns' in vm) { _columns = vm.columns; }

        _selectedObject = vm.selectedObject;
        _selectedColumn = vm.selectedColumn;
        _selectedValue = vm.selectedValue;
        _selectedRow = vm.selectedRow;

        if (vm.databaseInfo !== undefined) {
            _databaseInfo = vm.databaseInfo;
        }

        if (vm.serverName !== undefined) {
            $serverName.innerText = vm.serverName;
        }

        if (vm.databaseName !== undefined) {
            $databaseName.innerText = vm.databaseName;
        }

        renderSelectedObjectName(_selectedObject);

        if (vm.searchObjectName !== undefined) {
            $objectSearch.toggleClass('opened', true);
            $objectSearchInput.val(vm.searchObjectName);
        }

        $cbTables.get(0).checked = vm.selectTables === true;
        $cbViews.get(0).checked = vm.selectViews === true;

        if (vm.objectsSchema) {
            renderObjectsSchemaFilter(vm.objectsSchema, vm.filterObjectsSchema);
        }

        if (vm.objects !== undefined) {
            renderObjects(vm.objects, vm.selectedObjectIndex);
        }
        else {
            showLoading();
            sendMessage({
                'command': 'loadObjects'
            });
        }

        if (vm.rowsPageSize !== undefined) {
            $rowsPageSize.val(vm.rowsPageSize);
        }

        if (vm.columns !== undefined) {
            await renderColumns(vm.columns, vm.selectedColumnIndex, vm.sortColumnNames);
        }

        if (vm.values !== undefined) {
            _values = vm.values;
            _selectedValueIndex = vm.selectedValueIndex;
            _sortAscendingColumnValues = vm.sortAscendingColumnValues;
            _sortAscendingColumnValuesCount = vm.sortAscendingColumnValuesCount;
            renderValues(_values, _selectedColumn, _selectedValueIndex, _sortAscendingColumnValues, _sortAscendingColumnValuesCount);
        }

        if (vm.rows !== undefined) {
            renderRows(
                vm.rowsColumnsName, vm.rows, vm.rowsCount, vm.rowsPageIndex,
                vm.selectedRowRowIndex, vm.selectedRowColumnIndex,
                vm.selectedObjectIndex,
                vm.sortRowsByColumnName, vm.sortRowsByColumnAscending
            );
        }

        if (vm.filter !== undefined) {
            $txtFilter.val(vm.filter);
        }

        if (vm.filtersPanelOpen !== undefined) {
            toggleFiltersPanel(vm.filtersPanelOpen);
        }

        if (vm.autoApply !== undefined) {
            $autofilter.get(0).checked = vm.autoApply;
        }

        if (vm.showRecordDetails && _selectedRow && _columns) {
            showDatabaseTableRow(_selectedRow);
        }

        $liveMonitoring.get(0).checked = vm.liveMonitoring === true;
        $refreshTimer.val(vm.refreshTimer !== undefined ? vm.refreshTimer : 30);

        setLiveMonitoring();
    }


    // Renders
    //*********************************************************** */

    function renderCollection(collection, $container, $headerFunc, $elementFunc, selectedIndex) {
        let items = [];
        if ($headerFunc !== undefined && collection.length > 0) {
            items.push($headerFunc(collection));
        }
        collection.forEach((collectionItem, index) => {
            items.push(
                $elementFunc(collectionItem, index)
                    .data('item', collectionItem)
                    .data('item-index', index)
                    .toggleClass('selected', selectedIndex === index)
            );
        });
        $container.empty().append(items);
    }


    function renderValue(value, columnType) {
        return value === null ? '[NULL]' :
            value === '' ? '[Empty string]' :
                value === 0 && columnType === 'bit' ? 'False' :
                    value === 1 && columnType === 'bit' ? 'True' :
                        value;
    }


    function renderSelectedObjectName(object) {
        if (object) {
            $objectName.innerText = `${_databaseInfo.NameEncloserStart}${object.Schema}${_databaseInfo.NameEncloserEnd}.${_databaseInfo.NameEncloserStart}${object.Name}${_databaseInfo.NameEncloserEnd}`;
            $objectNamePart.show();
        }
        else {
            objectName.innerText = '';
            $objectNamePart.hide();
        }
    }


    const sortingTypes = ['', 'ascending', 'descending'];

    function setHeaderCircularSorting($header) {
        let sort = $header.data('sort');
        if (sort === undefined || sort === null || sortingTypes.indexOf(sort) < 0) {
            sort = '';
            $header.data('sort', sort);
        }
        $header.find('i').remove();
        switch (sort) {
            case 'ascending': 
                $header.append('<i class="ms-Icon ms-Icon--CaretSolidUp"></i>');
                break;
            case 'descending':
                $header.append('<i class="ms-Icon ms-Icon--CaretSolidDown"></i>');
                break;
        }
    }


    function renderObjects(objects, selectedIndex) {
        let tablesCount = objects.filter(o => o.ObjectType === 0).length;
        let viewsCount = objects.filter(o => o.ObjectType === 1).length;
        $tablesCount.innerText = $cbTables.get(0).checked ? `(${tablesCount})` : '';
        $viewsCount.innerText = $cbViews.get(0).checked ? `(${viewsCount})` : '';
        if (selectedIndex >= 0) {
            _selectedObject = objects[selectedIndex];
            renderSelectedObjectName(_selectedObject);
        }
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
                            .append(`<i class="ms-Icon ms-Icon--${object.ObjectType === 1 ? 'DatabaseView' : 'Table'}"></i>`)
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
                            .text(object.Count === undefined ? '' : object.Count)
                    )
                    .click(objectClicked),
            selectedIndex
        );
        filterObjectsData();
    }


    function renderObjectsSchemaFilter(objectsSchema, filterValue) {
        if (filterValue === undefined) {
            filterValue = $objectSchemaFilter.val();
        }
        else if (filterValue !== '*' && objectsSchema.indexOf(filterValue) < 0) {
            objectsSchema.unshift(filterValue);
        }

        filterValue = filterValue || '*';
        $objectFilters.toggleClass('schema', filterValue !== '*');

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


    async function renderColumns(columns, selectedIndex, sortColumnNames) {
        _columns = columns;
        $columnsCount.innerText = _selectedObject !== undefined ? `(${columns.length})` : '';
        let $table;
        renderCollection(columns,
            $table = $('#columns .table'),
            () =>
                $(`<div class="table-header">
                    <div class="col1 sortable">Name</div>
                    <div class="col2">Type</div>
                </div>`),
            (column) =>
                $(`<div class="table-data"></div>`)
                    .append(
                        $('<div class="col1"></div>')
                            .attr('title', column.Name)
                            .append('<i class="ms-Icon ms-Icon--Column"></i>')
                            .append('&nbsp;')
                            .append($(`<span${column.IsPrimaryKey ? ' class="primary-key"' : ''}></span>`).text(column.Name))
                    )
                    .append(
                        $('<div class="col2"></div>')
                            .attr('title', column.Type)
                            .text(column.Type)
                    )
                    .click(columnClicked),
            selectedIndex
        );
        setHeaderCircularSorting($table.find('.table-header .col1').data('sort', sortColumnNames).click(columnsHeaderNameClicked));
        if (selectedIndex == undefined) {
            $btnCopyValues.hide();
        }
    }


    function columnsHeaderNameClicked() {
        let $this = $(this);
        let sort = $this.data('sort') ?? '';
        let sortIndex = sortingTypes.indexOf(sort);
        sort = sortingTypes[(sortIndex + 1) % sortingTypes.length];
        $this.data('sort', sort);
        setHeaderCircularSorting($this);
        showLoading();
        updateViewModel({
            'sortColumnNames': sort
        });
        sendMessage({
            'command': 'reorderColumns|loadRows'
        });
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
        $btnCopyValues.toggle(Array.isArray(values) && values.length > 0);
    }


    function setHeaderSorting($header, sortAscending) {
        $header.find('i').remove();
        if (sortAscending === true) {
            $header.data('sort', 'ascending').append('<i class="ms-Icon ms-Icon--CaretSolidUp"></i>');
        }
        else if (sortAscending === false) {
            $header.data('sort', '').append('<i class="ms-Icon ms-Icon--CaretSolidDown"></i>');
        }
        else {
            $header.data('sort', $header.data('sort-default'));
        }
    }


    function valuesHeaderClicked() {
        let $this = $(this);
        _sortAscendingColumnValues = $this.data('sort') !== 'ascending';
        setHeaderSorting($('#values .table-header .col1'), _sortAscendingColumnValues);
        setHeaderSorting($('#values .table-header .col2'), undefined);

        const type = getBaseType(_selectedColumn.Type);
        const valueFunc = getSortableValueFunction(type);

        _values.sort((a, b) => {
            if (a.Value === '[NULL]') { return -1; }
            else if (b.Value === '[NULL]') { return 1; }
            else {
                const aValue = valueFunc(a.Value);
                const bValue = valueFunc(b.Value);
                if (_sortAscendingColumnValues) {
                    return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                }
                else {
                    return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
                }
            }
        });

        renderValues(_values, _selectedColumn, _selectedValueIndex, _sortAscendingColumnValues, undefined);

        updateViewModel({
            'values': _values,
            'sortAscendingColumnValues': _sortAscendingColumnValues,
            'sortAscendingColumnValuesCount': null,
        });
    }


    function valuesCountHeaderClicked() {
        let $this = $(this);
        _sortAscendingColumnValuesCount = $this.data('sort') !== 'ascending';
        setHeaderSorting($('#values .table-header .col1'), undefined);
        setHeaderSorting($('#values .table-header .col2'), _sortAscendingColumnValuesCount);

        if (_sortAscendingColumnValuesCount) {
            _values.sort((a, b) => {
                let aCount = parseInt(a.Count, 10);
                let bCount = parseInt(b.Count, 10);
                return aCount < bCount ? -1 : 
                    aCount > bCount ? 1 :
                    0;
            });
        }
        else {
            _values.sort((a, b) => {
                let aCount = parseInt(a.Count, 10);
                let bCount = parseInt(b.Count, 10);
                return aCount > bCount ? -1 : 
                    aCount < bCount ? 1 :
                    0;
            });         
        }

        renderValues(_values, _selectedColumn, _selectedValueIndex, undefined, _sortAscendingColumnValuesCount);

        updateViewModel({
            'values': _values,
            'sortAscendingColumnValues': null,
            'sortAscendingColumnValuesCount': _sortAscendingColumnValuesCount,
        });
    }


    const _notSortableTypes = ['text', 'ntext', 'xml', 'binary', 'varbinary', 'image', 'cursor', 'rowversion', 'hierarchyid', 'geometry', 'geography', 'sql_variant', 'table'];

    function renderRows(rowsColumnsName, rows, rowsCount, rowsPageIndex, selectedRowIndex, selectedColumnIndex, objectIndex, sortRowsByColumnName, sortRowsByColumnAscending) {
        let pageSize = parseInt($rowsPageSize.val());
        let firstRow = (rowsPageIndex - 1) * pageSize + 1;

        $rowsCount.innerText = `(${rowsCount})`;

        _rowsColumns = [];
        rowsColumnsName.forEach(name => _rowsColumns.push(_columns.filter(c => c.Name === name)[0]));
        renderCollection(rows,
            $('#dataRows .table'),
            () => {
                let header = $(`<div class="table-header"><div class="col row-index">row #</div></div>`);
                for (let index = 0; index < rowsColumnsName.length; index++) {
                    let name = rowsColumnsName[index];
                    let $header = $(`<div class="col"></div>`).text(name).appendTo(header);
                    let colType = _rowsColumns[index].Type;
                    if (_notSortableTypes.indexOf(colType) < 0) {
                        $header.addClass('sortable').data('column', name).data('sort', '').click(rowsHeaderClicked);
                    }
                    if (name === sortRowsByColumnName) {
                        if (sortRowsByColumnAscending === true) {
                            $header.data('sort', 'ascending').append('<i class="ms-Icon ms-Icon--CaretSolidUp"></i>');
                        }
                        else {
                            $header.data('sort', '').append('<i class="ms-Icon ms-Icon--CaretSolidDown"></i>');
                        }
                    }
                };
                return header;
            },
            (row, rowIndex) => {
                let element = $(`<div class="table-data"></div>`)
                    .click(rowClicked)
                    .dblclick(rowDblClicked);

                $(`<div class="col row-index">${rowIndex + firstRow}</div>`)
                    .toggleClass('cell-selected', rowIndex === selectedRowIndex && -1 === selectedColumnIndex)
                    .data('cell-value', `${rowIndex + firstRow}`)
                    .data('cell-index', -1)
                    .click(rowCellClicked)
                    .appendTo(element);

                row.Values.forEach((value, index) => {
                    if (_rowsColumns[index] !== null) {
                        $(`<div class="col"></div>`)
                            .toggleClass('cell-selected', rowIndex === selectedRowIndex && index === selectedColumnIndex)
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
        renderPager(rowsCount, rowsPageIndex);
    }


    function rowsHeaderClicked() {
        let $header = $(this);
        let colName = $header.data('column');
        let sortAscending = $header.data('sort') !== 'ascending';

        $('#dataRows .table-header i').remove();
        $('#dataRows .table-header .sortable').data('sort', '');

        if (sortAscending === true) {
            $header.data('sort', 'ascending').append('<i class="ms-Icon ms-Icon--CaretSolidUp"></i>');
        }
        else {
            $header.data('sort', '').append('<i class="ms-Icon ms-Icon--CaretSolidDown"></i>');
        }

        showLoading();
        updateViewModel({
            'sortRowsByColumnName': colName,
            'sortRowsByColumnAscending': sortAscending,
        });
        sendMessage({
            'command': 'loadRows'
        });
    }


    function renderPager(rowsCount, rowsPageIndex) {
        $rowsPager.find('li').removeClass('clicked');

        if (rowsCount === 0) {
            $rowsPager.hide();
            return;
        }

        const pageSize = parseInt($rowsPageSize.val());
        const pages = Math.ceil(rowsCount / pageSize);

        if (pages === 1) {
            $rowsPager.hide();
            return;
        }

        if (rowsPageIndex > pages) { rowsPageIndex = pages; }

        let firstPage = rowsPageIndex - 2;
        if (firstPage < 1) { firstPage = 1; }

        let lastPage = firstPage + 4;
        if (lastPage > pages) { lastPage = pages; }
        if ((lastPage - firstPage + 1) < 5) {
            firstPage = lastPage - 4;
            if (firstPage < 1) { firstPage = 1; }
        }

        let elements = $rowsPager.find('li.page');
        elements.addClass('hidden', true);
        for (let i = 0, page = firstPage; i < 5 && page <= lastPage; i++, page++) {
            let el = elements.eq(i);
            el.data('page', page);
            el.toggleClass('selected', rowsPageIndex === page);
            el.find('span').text(page);
            el.removeClass('hidden');
        }

        $rowsPager.find('.left-button').toggleClass('visible', rowsPageIndex > 1);
        $rowsPager.find('.right-button').toggleClass('visible', rowsPageIndex < pages);
        $rowsPager.show();
    }


    function filterObjectsData() {
        let filterValue = $objectSearchInput.val().trim().toLowerCase();
        let filterSchema = $objectSchemaFilter.val().toLowerCase();
        let filterTables = $cbTables.get(0).checked;
        let filterViews = $cbViews.get(0).checked;

        let objects = $('#objects .table-data');
        let objectsSchema = $('#objects .table-data .col2');
        let objectsName = $('#objects .table-data .col1');

        let tablesCount = 0;
        let viewsCount = 0;

        for (let index = 0; index < objects.length; index++) {
            let object = objects.eq(index);
            let objectSchema = objectsSchema.eq(index);
            let objectName = objectsName.eq(index);

            let isTable = objectName.find('i').hasClass('ms-Icon--Table');
            let isView = objectName.find('i').hasClass('ms-Icon--DatabaseView');

            let schema = objectSchema.text().toLowerCase();
            let name = objectName.text().toLowerCase();

            let show = true;
            if (filterSchema !== '*' && schema !== filterSchema) {
                show = false;
            }
            else if (filterValue !== '') {
                show = name.indexOf(filterValue) >= 0;
            }
            else if (filterTables === false && filterViews === false) {
                show = false;
            }
            else if (filterTables === false && isTable) {
                show = false;
            }
            else if (filterViews === false && isView) {
                show = false;
            }

            object.toggleClass('hidden', !show);

            if (show) {
                if (isTable) { tablesCount++; }
                if (isView) { viewsCount++; }
            }
        }

        $tablesCount.innerText = tablesCount > 0 ? `(${tablesCount})` : '';
        $viewsCount.innerText = viewsCount > 0 ? `(${viewsCount})` : '';
    }


    function toggleFiltersPanel(open) {
        if (arguments.length === 1) {
            $filtersHeader.toggleClass('filter-closed', !open);
            $filters.toggleClass('filter-closed', !open);
        }
        else {
            $filtersHeader.toggleClass('filter-closed');
            $filters.toggleClass('filter-closed');
        }
        updateViewModel({
            'filtersPanelOpen': !$filtersHeader.hasClass('filter-closed')
        });
    }


    // Event handlers
    //*********************************************************** */

    function filtersHeaderClicked() {
        toggleFiltersPanel();
    }


    function btnSearchObjectsClicked() {
        $objectSearch.toggleClass('opened', true);
        $objectSearchInput.focus();
    }


    function clearObjectSearchClicked() {
        $objectSearch.removeClass('opened');
        $objectSearchInput.val('');
        filterObjectsData();
    }


    function objectSearchInputChanged() {
        filterObjectsData();
        let filterValue = $objectSearchInput.val().trim().toLowerCase();
        updateViewModel({
            'searchObjectName': filterValue
        });
    }


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
        renderSelectedObjectName(_selectedObject);
        showLoading(2);
        updateViewModel({
            'selectedObjectIndex': selectedItem.data('item-index'),
            'rowsPageIndex': 1,
            'sortRowsByColumnName': null
        });
        sendMessage({
            'command': 'loadColumns|loadRows'
        });
        renderValues([]);
        textToCopy = `${_databaseInfo.NameEncloserStart}${_selectedObject.Schema}${_databaseInfo.NameEncloserEnd}.${_databaseInfo.NameEncloserStart}${_selectedObject.Name}${_databaseInfo.NameEncloserEnd}`;
    }


    function columnClicked() {
        setFocus('#columns');
        $('#columns .table .selected').removeClass('selected');
        let selectedItem = $(this).addClass('selected');
        _selectedColumn = selectedItem.data('item');
        _selectedValue = undefined;
        showLoading();
        // Determines if the column should be sorted ascending or descending by default
        var sortAscendingColumnValues = true;
        var columnType = getBaseType(_selectedColumn.Type);
        if (columnType.startsWith('date')) {
            sortAscendingColumnValues = false;
        }
        updateViewModel({
            'selectedColumnIndex': selectedItem.data('item-index'),
            'sortAscendingColumnValues': sortAscendingColumnValues,
            'sortAscendingColumnValuesCount': null,
        });
        sendMessage({
            'command': 'loadValues'
        });
        textToCopy = `${_databaseInfo.NameEncloserStart}${_selectedColumn.Name}${_databaseInfo.NameEncloserEnd}`;
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
        toggleFiltersPanel(true);
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
        toggleFiltersPanel(false);
        txtFilterChanged();
        updateViewModel({
            'filter': ''
        });
        if ($autofilter.get(0).checked) {
            applyFilter();
        }
    }


    function btnCopyValuesClicked() {
        let values = $('#values .table-data');
        if (values.length > 0) { 
            let text = 'Value\tCount\n';
            for (let index = 0; index < values.length; index++) {
                let item = values.eq(index).data('item');
                text += `${item.Value}\t${item.Count}\n`;
            }
            sendMessage({
                'command': 'copyText',
                'item': text
            });
            sendMessage({
                'command': 'showMessage',
                'item': 'Values copied to clipboard.'
            });
        }
    }


    function applyFilter() {
        _selectedValue = undefined;
        _selectedRow = undefined;
        updateViewModel({
            'selectedValueIndex': null,
            'selectedRowRowIndex': null,
            'selectedRowColumnIndex': null,
            'rowsPageIndex': 1
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

        if (!isLiveMonitoringEnabled) {
            if (liveMonitoringIntervalHandler !== undefined) {
                clearInterval(liveMonitoringIntervalHandler);
                liveMonitoringIntervalHandler = undefined;
            }
        }
        else if (liveMonitoringIntervalHandler === undefined) {

            let refreshFunc = () => {
                let tables = $('#objects .table-data:not(.hidden)');
                let tasks = [];

                for (let index = 0; index < tables.length; index++) {
                    let table = tables.eq(index);
                    let item = table.data('item');
                    tasks.push({
                        'item': item,
                        'message': {
                            'command': 'loadRowsCount',
                            'index': table.data('item-index')
                        }
                    });
                }

                if (_selectedObject !== undefined) {
                    tasks.push({
                        'message': {
                            'command': 'loadRows'
                        }
                    });
                }

                if (_selectedColumn !== undefined) {
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

                        if (task.item !== undefined) {
                            let tables = $('#objects .table-data:not(.hidden)');
                            let currentTable = tables.eq(idx).data('item');
                            if (
                                currentTable === undefined
                                || (currentTable.Name !== task.item.Name && currentTable.Schema !== task.item.Schema)
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
            };

            let tables = $('#objects .table-data:not(.hidden)');
            let intervalTableMs = pauseBetweenCommands * (tables.length + 1) + 1000;

            refreshFunc();

            setTimeout(() => {
                if (liveMonitoringIntervalHandler !== undefined) {
                    clearInterval(liveMonitoringIntervalHandler);
                    liveMonitoringIntervalHandler = undefined;
                }
                if (isLiveMonitoringEnabled) {
                    let tables = $('#objects .table-data:not(.hidden)');
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
        if (liveMonitoringIntervalHandler !== undefined) {
            clearInterval(liveMonitoringIntervalHandler);
            liveMonitoringIntervalHandler = undefined;
        }
        isLiveMonitoringEnabled = false;
        setTimeout(() => {
            setLiveMonitoring();
        }, pauseBetweenCommands * 2);
    }


    function setObjectsSchemaFilter() {
        filterObjectsData();
        var filterValue = $objectSchemaFilter.val();
        $objectFilters.toggleClass('schema', filterValue !== '*');
        updateViewModel({
            'filterObjectsSchema': filterValue
        });
    }


    function objectsChanged() {
        filterObjectsData();
        updateViewModel({
            'selectTables': $cbTables.get(0).checked,
            'selectViews': $cbViews.get(0).checked
        });
    }


    function setPageSize() {
        let pageSize = $rowsPageSize.val();
        updateViewModel({
            'rowsPageSize': pageSize,
            'rowsPageIndex': 1
        });
        showLoading(1);
        sendMessage({
            'command': 'loadRows'
        });
    }


    function btnPageClicked() {
        let page = $(this).addClass('clicked').data('page');
        showLoading(1);
        sendMessage({
            'command': 'changeRowsPage',
            'rowsPageIndex': page
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

    function getBaseType(type) {
        let baseType = type.split(' ')[0];
        if (baseType.indexOf(':') > 0) {
            baseType = baseType.substring(baseType.indexOf(':') + 1);
        }
        return baseType;
    }

    function AddFilter(operand) {
        let filter = $txtFilter.val().trim();
        if (filter.length > 0) { filter += " " + operand + " "; }
        let val = _selectedValue;
        if (val === null || val === "[NULL]" || val === "[NOT NULL]") {
            //filter += "([" + _selectedColumn.Name + "] IS " + ((val === null || val === "[NULL]") ? "NULL" : "NOT NULL") + ")";
            filter += `(${_databaseInfo.NameEncloserStart}${_selectedColumn.Name}${_databaseInfo.NameEncloserEnd} IS ${(val === null || val === "[NULL]") ? "NULL" : "NOT NULL"})`;
        }
        else {
            let type = getBaseType(_selectedColumn.Type);
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
                case "enum": // MySQL
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
            //filter += "([" + _selectedColumn.Name + "] = " + val + ")";
            filter += `(${_databaseInfo.NameEncloserStart}${_selectedColumn.Name}${_databaseInfo.NameEncloserEnd} = ${val})`;
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


    // Sorting utility
    //*********************************************************** */

    function getSortableValueFunction(columntType) {
        switch (columntType) {
            case "int":
            case "byte":
            case "tinyint":
            case "smallint":
            case "bigint":
            case "bit":
                {
                    return (value) => parseInt(value, 10);
                }
            case "float":
            case "double":
            case "real":
            case "decimal":
            case "money":
            case "smallmoney":
                {
                    return (value) => parseFloat(value);
                }
            case "date":
            case "datetime":
            case "datetime2":
            case "datetimeoffset":
            case "smalldatetime":
                {
                    // parse date in format 'yyyy-MM-dd HH:mm:ss.SS +00:00'
                    return (value) => {
                        let date;
                        let [datePart, timePart, timeZone] = value.split(' ');
                        let [year, month, day] = datePart.split('-').map(Number);
                        if (timePart !== undefined) {
                            if (timePart[0] === '+' || timePart[0] === '-') {
                                // date with timezone offset
                                date = new Date(Date.UTC(year, month - 1, day));
                                timeZone = timePart;
                            }
                            else {
                                // date with time
                                let [timeWithoutMilliseconds, milliseconds] = timePart.split('.');
                                let [hour, minute, second] = timeWithoutMilliseconds.split(':').map(Number);
                                date = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
                                if (milliseconds !== undefined) {
                                    date.setMilliseconds(parseInt(milliseconds, 10));
                                }
                            }
                            if (timeZone !== undefined) {
                                // handle timezone offset
                                let sign = timeZone[0];
                                let [hoursOffset, minutesOffset] = timeZone.slice(1).split(':').map(Number);
                                let totalMinutesOffset = hoursOffset * 60 + minutesOffset;
                                totalMinutesOffset = (sign === '+' ? -1 : 1) * totalMinutesOffset;
                                date.setMinutes(date.getMinutes() + totalMinutesOffset);
                            }
                        }
                        else {
                            // only date
                            date = new Date(Date.UTC(year, month - 1, day));
                        }                
                        return date;
                    };
                }
            case "time":
                {   
                    // parse time in format 'HH:mm:ss.SS'
                    return (value) => {
                        let [timeWithoutMilliseconds, milliseconds] = value.split('.');
                        let [hour, minute, second] = timeWithoutMilliseconds.split(':').map(Number);
                        let date = new Date(0);
                        date.setUTCHours(hour, minute, second || 0);
                        if (milliseconds !== undefined) {
                            date.setMilliseconds(parseInt(milliseconds, 10));
                        }
                        return date;
                    };
                }
        };
        return (value) => value;
    }

})(jQuery);