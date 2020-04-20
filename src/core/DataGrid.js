/**
 * 程序入口
 */
import { h } from './element.js'
import Paint from './Paint.js'
import Body from './Body.js'
import Header from './Header.js'
import Editor from './Editor.js'
import Scroller from './Scroller.js'
import Events from './Events.js'
import Tooltip from './Tooltip.js'
import { dpr } from './config.js'
import { 
    CSS_PREFIX, 
    MIN_CELL_WIDTH, 
    ROW_INDEX_WIDTH, 
    CHECK_BOX_WIDTH,
    SCROLLER_TRACK_SIZE,
    HEADER_HEIGHT
} from './constants.js'
// import './index.scss'

class DataGrid {
    constructor(target, options) {
        this.target = target
        this.scrollY = 0;
        this.scrollX = 0;

        this.scrollerTrackSize = SCROLLER_TRACK_SIZE;
        this.fillCellWidth = 0; // 所有列宽总和若小于视宽，则需要补全
        this.originFixedWidth = ROW_INDEX_WIDTH + CHECK_BOX_WIDTH
        
        this.color = '#495060'
        this.borderColor = '#dee0e3'
        this.fillColor = '#f8f9fa'
        this.borderWidth = 1

        this.focusCell = null

        this.hashChange = {} // diff changed

        // 选择区域
        this.selector = {
            show: false, // 是否显示
            isSelected: false, // 单击鼠标按下代表即将要开始范围选择
            xArr: [-1, -1], // 选中区域
            yArr: [-1, -1]
        }
        this.editor = {
            show: false,
            xIndex: 0,
            yIndex: 0
        }
        // 自动填充
        this.autofill = {
            enable: false, // 为true代表要开始下拉数据填充
            xIndex: 0, // 数据填充触点的坐标
            yIndex: 0,
            xArr: [-1, -1], // 数据填充的范围
            yArr: [-1, -1]
        }
        this.copyyer = {
            show: false,
            xArr: [-1, -1],
            yArr: [-1, -1]
        }

        // 生成主画笔
        this.painter = new Paint(target)

        this.initConfig(options)

        // this.createContainer()

        this.createClipboard()

        // Headers 表头对象
        this.header = new Header(this, 0, 0, this.columns)

        // Body 主体
        this.body = new Body(this, this.columns, this.data)

        // 滚动条
        this.scroller = new Scroller(this)

        this.setLayoutSize(options) // 设置容器宽高

        this.setTableSize() // 设置网格实际宽高

        this.tooltip = new Tooltip(this, 0, 0)

        this.events = new Events(this, target)
        
        this.initPaint()
    }
    /**
     * 容器初始化相关
     */
    initConfig(options) {
        Object.assign(this, {
            columns: [],
            data: [],
            color: '#495060',
            borderColor: '#dee0e3',
            fillColor: '#f8f9fa',
            borderWidth: 1,
            fixedLeft: 0,
            fixedRight: 0,
            showCheckbox: true,
            onSelectCell: (cell) => {},
            onMultiSelectCell: (cells) => {},
            onEditCell: (cell) => {},
            onSelectRow: (row) => {},
            onResizeColumn: () => {},
            onResizeRow: () => {}
          }, options);
        this.columnsLength = this.columns.length
        this.range = { // 编辑器边界范围
            minX: this.fixedLeft,
            maxX: this.columns.length - 1 - this.fixedRight,
            minY: 0,
            maxY: this.data.length - 1
        }
    }
    setLayoutSize(options = {}) {
        const el = this.target.parentElement
        const {
            width,
            left,
            top
        } = el.getBoundingClientRect()
        this.containerOriginX = left;
        this.containerOriginY = top;
        this.width = options.width || width; // 容器宽
        this.height = options.height || (window.innerHeight - top); // 容器高

        this.target.width = this.width * dpr;
        this.target.height = this.height * dpr;
        this.target.style.width = this.width + "px";
        this.target.style.height = this.height + "px";
        el.style.height = this.height + "px";
        this.painter.scaleCanvas(dpr)
    }
    resize() {
        const diffX = this.tableWidth - this.width + this.scrollX
        this.setLayoutSize()
        this.scroller.init()
        if (this.tableWidth - this.width + this.scrollX < 0) { // 小屏滚动到最右侧再调大屏幕断开的问题
            this.scrollX = this.width - this.tableWidth + diffX
        }
    }
    createContainer() {
        // 顶层容器
        this.rootEl = h('div', `${CSS_PREFIX}`);

        // this.loadingEl = h('div', `${CSS_PREFIX}-loading`)
        //     .children(
        //         this.loadingDot = h('div', `${CSS_PREFIX}-loading-dot`)
        //     )
        // 画布外层容器
        this.wrapEl = h('div', `${CSS_PREFIX}-main`);
        this.wrapEl.offset({
            width: this.width,
            height: this.height
        })
        this.rootEl.children(
            this.wrapEl
        )
        
        // 画布
        this.tableEl = h('canvas', `${CSS_PREFIX}-table`);
        
        // 编辑器
        this.editor = new Editor(this)
        // this.selector = new Selector()

        // 编辑器、选区容器
        this.overlayerEl = h('div', `${CSS_PREFIX}-overlayer`)
            .children(
                this.editor.el,
                // this.selector.el
            )

        this.wrapEl.children(
            this.tableEl,
            this.overlayerEl
        )

        this.target.appendChild(this.rootEl.el)
    }
    createClipboard() {
        this.clipboardEl = h('textarea', '')
                    .on('paste', e => this.paste(e))
        this.clipboardEl.css({
            position: 'absolute',
            left: '-10000px',
            top: '-10000px'
        })
        document.body.appendChild(this.clipboardEl.el)
    }
    setTableSize() {
        this.fixedLeftWidth = this.originFixedWidth
        let rightWidth = 0
        this.header.fixedColumnHeaders.forEach(item => {
            if (item.index < this.fixedLeft) {
                this.fixedLeftWidth += item.width
            }
            if (item.index > this.columnsLength - 1 - this.fixedRight) {
                rightWidth += item.width
            }
        })
        this.fixedRightWidth = rightWidth + this.scrollerTrackSize
        this.tableWidth = this.header.columnHeaders.reduce((sum, item) => {
            return sum + item.width
        }, this.fixedLeftWidth + rightWidth)

        this.tableHeight = this.body.height
        
        this.scroller.init()
    }
    /**
     * 选择、编辑相关
     */
    // mousedown事件 -> 开始拖拽批量选取
    selectCell({ colIndex, rowIndex }) {
        this.clipboardEl.el.focus()
        this.doneEdit()
        this.clearMultiSelect();
        this.editor.xIndex = colIndex
        this.editor.yIndex = rowIndex
        this.selector.show = true;
        this.selector.isSelected = true
        this.adjustBoundaryPosition()
    }
    // mousemove事件 -> 更新选取范围
    multiSelectCell(x, y) {
        const selector = this.selector
        if(selector.isSelected) {
            const minX = x > this.editor.xIndex ? this.editor.xIndex : x
            const maxX = x > this.editor.xIndex ? x : this.editor.xIndex
            const minY = y > this.editor.yIndex ? this.editor.yIndex : y
            const maxY = y > this.editor.yIndex ? y : this.editor.yIndex
            this.autofill.xIndex = maxX
            this.autofill.yIndex = maxY
            selector.xArr = [minX, maxX]
            selector.yArr = [minY, maxY]
        }
        // 设置autofill填充区域
        if (this.autofill.enable) {
            this.autofill.xArr = selector.xArr.slice()
            this.autofill.yArr = selector.yArr.slice()
            if (y >= selector.yArr[0] && y <= selector.yArr[1]) {
                if (x > selector.xArr[1]) {
                    this.autofill.xArr.splice(1, 1, x)
                } else if (x < selector.xArr[0]) {
                    this.autofill.xArr.splice(0, 1, x)
                }
            } else {
                if (y > selector.yArr[1]) {
                    this.autofill.yArr.splice(1, 1, y)
                } else if (y < selector.yArr[0]) {
                    this.autofill.yArr.splice(0, 1, y)
                }
            }
        }
    }
    // mouseup事件
    endMultiSelect() {
        this.selector.isSelected = false;
        if (this.selector.show && this.autofill.enable) {
            this.body.autofillData()
            this.autofill.enable = false;
        }
    }
    // 清空批量选取
    clearMultiSelect() {
        this.selector.xArr = [-1, -1];
        this.selector.yArr = [-1, -1];
    }
    startAutofill() {
        this.autofill.enable = true
    }
    clearAuaofill() {
        this.selector.xArr.splice(0, 1, this.autofill.xArr[0])
        this.selector.xArr.splice(1, 1, this.autofill.xArr[1])
        this.selector.yArr.splice(0, 1, this.autofill.yArr[0])
        this.selector.yArr.splice(1, 1, this.autofill.yArr[1])
        this.autofill.xIndex = this.selector.xArr[1]
        this.autofill.yIndex = this.selector.yArr[1]
        // 填充完数据清空
        this.autofill.xArr = [-1, -1];
        this.autofill.yArr = [-1, -1];
    }
    // 开始编辑
    startEdit(value) {
        // this.editor.setData(cell.value)
        // if (cell.dateType === 'date' || cell.dateType === 'select') {
        //     this.onEditCell(cell)
        // } else {
        //     this.selector.show = false;
        //     this.editor.fire(cell);
        // }
        if (this.focusCell && !this.focusCell.readonly) {
            value && this.setData(value)
            this.editor.show = true
            this.selector.show = false;
            this.onEditCell({
                value: value || this.focusCell.value,
                x: this.focusCell.x,
                y: this.focusCell.y,
                width: this.focusCell.width,
                height: this.focusCell.height,
                dateType: this.focusCell.dateType,
                options: this.focusCell.options,
                scrollX: this.scrollX,
                scrollY: this.scrollY
            })
        }
    }
    // 完成编辑
    doneEdit() {
        if (this.editor.show && this.focusCell) {
            // const cell = this.body.getCell(this.editor.xIndex, this.editor.yIndex)
            // if (cell) {
            //     cell.value = this.editor.value
            //     // this.rePaintRow(this.editor.yIndex)
            // }
            // this.editor.hide();
            this.focusCell.validate()
            this.editor.show = false
            this.selector.show = true; // 编辑完再选中该单元格
            this.onSelectCell(this.focusCell)
            this.clearCopyyer()
        }
    }
    setData(value) {
        this.focusCell && this.focusCell.setData(value)
    }
    /**
     * 调整列宽、行宽
     */
    resizeColumn(colIndex, width) {
        if (width < MIN_CELL_WIDTH) return;

        this.header.resizeColumn(colIndex, width);

        this.body.resizeColumn(colIndex, width)
    
        this.setTableSize()
    }
    resizeRow(rowIndex, height) {
        this.body.resizeRow(rowIndex, height)
        this.setTableSize()
    }
    handleCheckRow(y) {
        this.body.handleCheckRow(y)
    }
    copy() {
        const { text } = this.body.getSelectedData()
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy', false) // copy到剪切板
        document.body.removeChild(textArea)
        this.copyyer.show = true
        this.copyyer.xArr = this.selector.xArr.slice()
        this.copyyer.yArr = this.selector.yArr.slice()
    }
    clearCopyyer() {
        this.copyyer.show = false
        this.copyyer.xArr = [-1, -1]
        this.copyyer.yArr = [-1, -1]
    }
    paste(e) {
        let textArr
        let rawText = e.clipboardData.getData('text/plain')
        // let arr = isMac ? rawText.split('\r').map(item => item.split('\t')) : rawText.split('\r').map(item => item.split('\t')).slice(0, -1) // windows系统截取掉最后一个空白字符
        let arr = rawText.split('\r')
        if (arr.length === 1) {
            let _arr = arr[0].split('\n')
            textArr = _arr.map(item => item.split('\t'))
        } else {
            textArr = arr.map(item => item.split('\t'))
        }
        console.log(textArr)
        if (textArr.length) {
            this.body.updateData(textArr)
            // // 复制完把被填充的区域选中，并把激活单元格定位到填充区域的第一个
            this.selector.xArr.splice(1, 1, this.editor.xIndex + textArr[0].length - 1)
            this.selector.yArr.splice(1, 1, this.editor.yIndex + textArr.length - 1)
            this.autofill.xIndex = this.selector.xArr[1]
            this.autofill.yIndex = this.selector.yArr[1]

            this.clearCopyyer()
        }
    }
    moveFocus(dir) {
        switch(dir) {
            case 'LEFT':
                if (this.editor.xIndex > this.range.minX) {
                    this.editor.xIndex--
                    this.adjustBoundaryPosition()
                }
                break
            case 'TOP':
                if (this.editor.yIndex > this.range.minY) {
                    this.editor.yIndex--
                    this.adjustBoundaryPosition()
                }
                break
            case 'RIGHT':
                if (this.editor.xIndex < this.range.maxX) {
                    this.editor.xIndex++
                    this.adjustBoundaryPosition()
                }
                break
            case 'BOTTOM':
                if (this.editor.yIndex < this.range.maxY) {
                    this.editor.yIndex++
                    this.adjustBoundaryPosition()
                }
                break
            default:
                //
        }
    }
    adjustBoundaryPosition() {
        this.focusCell = this.body.getCell(this.editor.xIndex, this.editor.yIndex)
        
        this.selector.xArr = [this.editor.xIndex, this.editor.xIndex]
        this.selector.yArr = [this.editor.yIndex, this.editor.yIndex]
        this.autofill.xIndex = this.editor.xIndex
        this.autofill.yIndex = this.editor.yIndex

        const cellTotalViewWidth = this.focusCell.x + this.focusCell.width + this.scrollX
        const cellTotalViewHeight = this.focusCell.y + this.focusCell.height + this.scrollY
        const viewWidth = this.width - this.fixedRightWidth
        const viewHeight = this.height - this.scrollerTrackSize
        const diffLeft = this.focusCell.x + this.scrollX - this.fixedLeftWidth
        const diffRight = viewWidth - cellTotalViewWidth
        const diffTop = this.focusCell.y + this.scrollY - HEADER_HEIGHT
        const diffBottom = viewHeight - cellTotalViewHeight
        // const fillWidth = this.focusCell.colIndex < this.columnsLength - 1 - this.fixedRight ?
        //     this.focusCell.x + this.scrollX - viewWidth
        //     : 0
        if (diffRight < 0) {
            this.scroller.update(diffRight, 'HORIZONTAL')
        } else if (diffLeft < 0) {
            this.scroller.update(-diffLeft, 'HORIZONTAL')
        }
        if (diffTop < 0) {
            this.scroller.update(-diffTop, 'VERTICAL')
        } else if (diffBottom < 0) {
            this.scroller.update(diffBottom, 'VERTICAL')
        }
    }
    /**
     * 画布绘制相关
     */
    initPaint() {
        this.draw()
        window.requestAnimationFrame(this.initPaint.bind(this));
    }
    drawContainer() {
        this.painter.drawRect(0, 0, this.width, this.height, {
            borderColor: this.borderColor,
            // fillColor: '#fff',
            borderWidth: this.borderWidth
        })
    }
    draw() {
        this.painter.clearCanvas()

        // body
        this.body.draw()
        
        // 数据校验错误提示
        this.tooltip.draw()

        // 绘制表头
        this.header.draw();

        // 绘制滚动条
        this.scroller.draw();

        // 绘制外层容器
        this.drawContainer()
    }
    getCheckedRow() {
        return this.body.getCheckedRow()
    }
    getChangedRow() {
        return this.body.getChangedRow()
    }
}
export default DataGrid