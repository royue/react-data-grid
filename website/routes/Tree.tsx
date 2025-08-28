 
import React, { useState, useMemo } from 'react';
// import DataGrid, { type Column } from 'react-data-grid';
import { DataGrid, SelectColumn, textEditor } from '../../src';
import { 
  DndContext, 
  DragOverlay, 
  MouseSensor, 
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimationSideEffects,
  pointerWithin
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { 
  FolderOpenOutlined, 
  FolderOutlined, 
  FileOutlined, 
  MenuOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons';
import { Button, Dropdown, Menu } from 'antd';

// 树节点类型
const FileType = {
  FOLDER: 'folder',
  FILE: 'file'
};

// 树节点数据结构
const createNode = (
  id: number,
  name: string,
  type: typeof FileType[keyof typeof FileType],
  parentId: number | null = null,
  depth=0
) => ({
  id,
  name,
  type,
  parentId,
  depth,
  expanded: type === FileType.FOLDER,
  children: []
});

// 生成示例数据
const generateData = () => {
  const root = createNode(1, '项目文档', FileType.FOLDER);
  
  const design = createNode(2, '设计稿', FileType.FOLDER, 1, 1);
  design.children = [
    createNode(3, '首页设计.psd', FileType.FILE, 2, 2),
    createNode(4, '详情页设计.fig', FileType.FILE, 2, 2),
  ];
  
  const development = createNode(5, '开发文档', FileType.FOLDER, 1, 1);
  development.children = [
    createNode(6, 'API文档.md', FileType.FILE, 5, 2),
    createNode(7, '数据库设计.sql', FileType.FILE, 5, 2),
    createNode(8, '接口文档.md', FileType.FILE, 5, 2),
  ];
  
  const assets = createNode(9, '静态资源', FileType.FOLDER, 1, 1);
  assets.children = [
    createNode(10, '图片', FileType.FOLDER, 9, 2),
    createNode(11, '字体', FileType.FOLDER, 9, 2),
  ];
  
  root.children = [design, development, assets];
  
  return root;
};

// 扁平化树结构
const flattenTree = (node:unknown, expandedIds = new Set(), depth = 0) => {
  const flatNodes = [{
    ...node,
    depth,
    isExpanded: expandedIds.has(node.id) || node.expanded
  }];
  
  if (node.children && node.children.length > 0 && flatNodes[0].isExpanded) {
    node.children.forEach((child: unknown) => {
      flatNodes.push(...flattenTree(child, expandedIds, depth + 1));
    });
  }
  
  return flatNodes;
};

// 自定义行渲染器
function RowRenderer({ row, children, isDragging }) {
  const indentSize = 24;
  
  return (
    <div 
      className={`rdg-row ${isDragging ? 'dragging' : ''}`}
      style={{ 
        display: 'flex',
        alignItems: 'center',
        paddingLeft: `${row.depth * indentSize + 10}px`,
        background: isDragging ? '#f0f7ff' : 'white'
      }}
    >
      <div className="drag-handle" style={{ marginRight: '10px', cursor: 'grab' }}>
        <MenuOutlined style={{ color: '#8c8c8c' }} />
      </div>
      <div style={{ marginRight: '8px' }}>
        {row.type === FileType.FOLDER ? 
          (row.isExpanded ? <FolderOpenOutlined style={{ color: '#1890ff' }} /> : <FolderOutlined style={{ color: '#1890ff' }} />) : 
          <FileOutlined style={{ color: '#52c41a' }} />
        }
      </div>
      {children}
    </div>
  );
}

// 主组件
function TreeGridWithDnD() {
  const [root, setRoot] = useState(generateData());
  const [expandedIds, setExpandedIds] = useState(new Set([1, 2, 5, 9]));
  const [activeId, setActiveId] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [addToFolder, setAddToFolder] = useState(null);
  
  const flatData = flattenTree(root, expandedIds);
  
  const columns = [
    {
      key: 'name',
      name: '名称',
      renderCell: ({ row }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>{row.name}</div>
          <div>
            <Dropdown 
              overlay={
                <Menu>
                  <Menu.Item key="edit" icon={<EditOutlined />}>重命名</Menu.Item>
                  <Menu.Item key="delete" icon={<DeleteOutlined />} danger>删除</Menu.Item>
                </Menu>
              }
              trigger={['click']}
            >
              <Button type="text" icon={<MenuOutlined />} size="small" />
            </Dropdown>
          </div>
        </div>
      )
    },
    { 
      key: 'type', 
      name: '类型', 
      renderCell: ({ row }) => row.type === FileType.FOLDER ? '文件夹' : '文件' 
    },
    { 
      key: 'actions', 
      name: '操作',
      renderCell: ({ row }) => (
        <div>
          {row.type === FileType.FOLDER && (
            <Button 
              type="primary" 
              size="small" 
              icon={<PlusOutlined />}
              onClick={() => {
                setAddingItem(true);
                setAddToFolder(row.id);
              }}
            >
              添加
            </Button>
          )}
        </div>
      )
    }
  ];
  
  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  
  // 切换展开/折叠状态
  const toggleExpand = (id) => {
    const newExpandedIds = new Set(expandedIds);
    if (newExpandedIds.has(id)) {
      newExpandedIds.delete(id);
    } else {
      newExpandedIds.add(id);
    }
    setExpandedIds(newExpandedIds);
  };
  
  // 处理拖拽开始事件
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };
  
  // 处理拖拽结束事件
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }
    
    // 在实际应用中，这里会更新树结构
    console.log(`将节点 ${active.id} 移动到节点 ${over.id}`);
    
    setActiveId(null);
  };
  
  // 获取活动节点
  const activeItem = activeId ? flatData.find(item => item.id === activeId) : null;
  
  // 自定义拖拽覆盖层
  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5'
        }
      }
    })
  };

  // 添加新项目
  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    
    // 在实际应用中，这里会更新树结构
    console.log(`在文件夹 ${addToFolder} 中添加新项目: ${newItemName}`);
    
    setNewItemName('');
    setAddingItem(false);
    setAddToFolder(null);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>树状文件管理器</h1>
        <p>使用 react-data-grid 和 @dnd-kit/core 实现，搭配 Ant Design 图标</p>
      </div>
      
      <div className="toolbar">
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => {
            setAddingItem(true);
            setAddToFolder(1); // 默认添加到根目录
          }}
        >
          添加新项目
        </Button>
        <div className="stats">
          <span>文件夹: {flatData.filter(item => item.type === FileType.FOLDER).length}</span>
          <span>文件: {flatData.filter(item => item.type === FileType.FILE).length}</span>
        </div>
      </div>
      
      {addingItem && (
        <div className="add-item-form">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="输入项目名称"
            autoFocus
          />
          <div className="actions">
            <Button onClick={() => setAddingItem(false)}>取消</Button>
            <Button type="primary" onClick={handleAddItem}>添加</Button>
          </div>
        </div>
      )}
      
      <div className="grid-container">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <DataGrid
            columns={columns}
            rows={flatData}
            rowKeyGetter={row => row.id}
            rowHeight={50}
            renderers={{
              renderRow: (props) => (
                <RowRenderer 
                  {...props} 
                  isDragging={props.row.id === activeId}
                />
              )
            }}
            onRowClick={(row) => {
              if (row.type === FileType.FOLDER) {
                toggleExpand(row.id);
              }
            }}
            className="tree-grid"
            style={{ height: 500 }}
          />
          
          <DragOverlay dropAnimation={dropAnimation}>
            {activeItem ? (
              <div className="drag-preview">
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px' }}>
                  <div style={{ marginRight: '12px', fontSize: '18px' }}>
                    {activeItem.type === FileType.FOLDER ? 
                      (activeItem.isExpanded ? <FolderOpenOutlined style={{ color: '#1890ff' }} /> : <FolderOutlined style={{ color: '#1890ff' }} />) : 
                      <FileOutlined style={{ color: '#52c41a' }} />
                    }
                  </div>
                  <div>
                    <div className="item-name">{activeItem.name}</div>
                    <div className="item-type">{activeItem.type === FileType.FOLDER ? '文件夹' : '文件'}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      
      <div className="instructions">
        <h3><MenuOutlined style={{ marginRight: 8 }} /> 使用说明</h3>
        <ul>
          <li>点击文件夹图标展开/折叠目录</li>
          <li>拖拽 <MenuOutlined /> 图标可调整文件/文件夹位置</li>
          <li>使用操作列按钮添加新项目</li>
          <li>点击行右侧菜单可进行更多操作</li>
        </ul>
      </div>
    </div>
  );
}

// 样式
const styles = `
  * {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }
  
  body {
    margin: 0;
    padding: 20px;
    background: linear-gradient(135deg, #f0f2f5 0%, #e6f7ff 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    color: rgba(0, 0, 0, 0.85);
  }
  
  .app {
    width: 1000px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }
  
  .header {
    padding: 25px 30px;
    background: linear-gradient(120deg, #1677ff 0%, #0958d9 100%);
    color: white;
  }
  
  .header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 600;
  }
  
  .header p {
    margin: 8px 0 0;
    opacity: 0.9;
    font-size: 16px;
  }
  
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .toolbar .stats {
    display: flex;
    gap: 15px;
    color: #595959;
    font-size: 14px;
  }
  
  .add-item-form {
    padding: 15px 20px;
    background: #e6f4ff;
    border-bottom: 1px solid #91caff;
    display: flex;
    gap: 10px;
  }
  
  .add-item-form input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #91caff;
    border-radius: 4px;
    font-size: 14px;
  }
  
  .add-item-form .actions {
    display: flex;
    gap: 8px;
  }
  
  .grid-container {
    padding: 20px;
  }
  
  .tree-grid {
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }
  
  .rdg-row {
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.2s;
  }
  
  .rdg-row:hover {
    background-color: #f9f9f9 !important;
  }
  
  .rdg-row.dragging {
    background-color: #f0f7ff;
    opacity: 0.8;
  }
  
  .drag-handle {
    opacity: 0.5;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
  }
  
  .rdg-row:hover .drag-handle {
    opacity: 1;
  }
  
  .drag-preview {
    background: white;
    border-radius: 8px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
    border: 1px solid #e0e0e0;
    font-weight: 500;
    min-width: 220px;
  }
  
  .drag-preview .item-name {
    font-weight: 600;
    font-size: 15px;
  }
  
  .drag-preview .item-type {
    font-size: 12px;
    color: #8c8c8c;
    margin-top: 4px;
  }
  
  .instructions {
    padding: 20px;
    background: #f8f9fa;
    border-top: 1px solid #eee;
    font-size: 14px;
    color: #595959;
  }
  
  .instructions h3 {
    margin-top: 0;
    color: #262626;
    font-size: 17px;
    display: flex;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .instructions ul {
    padding-left: 20px;
    margin-bottom: 0;
  }
  
  .instructions li {
    margin-bottom: 10px;
    line-height: 1.5;
  }
  
  .rdg-cell {
    display: flex;
    align-items: center;
  }
  
  @media (max-width: 768px) {
    .app {
      width: 95%;
      margin: 10px auto;
    }
    
    .toolbar {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
  }
`;

// 应用入口
function App() {
  return <>
    <style>{styles}</style>
    <TreeGridWithDnD />
  </>
}

export default App;