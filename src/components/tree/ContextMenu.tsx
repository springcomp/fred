import { ArrowDown, ArrowUp, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { findParent, getInsertableKinds, getSiblingInsertableKinds, type InsertableKind } from '@/model/types';
import { useEditorStore } from '@/store/editorStore';
import { insertKindIcon, insertKindLabel } from './NodeIcon';

/** Position for the context menu. */
export interface MenuPosition {
  x: number;
  y: number;
  nodeId: string;
}

export function ContextMenu({ position, onClose }: { position: MenuPosition; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const nodeMap = useEditorStore(s => s.nodeMap);
  const schema = useEditorStore(s => s.schema);
  const addChildNode = useEditorStore(s => s.addChildNode);
  const addSiblingAfter = useEditorStore(s => s.addSiblingAfter);
  const deleteNode = useEditorStore(s => s.deleteNode);
  const moveNodeUp = useEditorStore(s => s.moveNodeUp);
  const moveNodeDown = useEditorStore(s => s.moveNodeDown);

  const [subMenu, setSubMenu] = useState<'child' | 'sibling' | null>(null);
  const [subMenuPos, setSubMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const node = nodeMap.get(position.nodeId);

  // Close on outside click or Escape
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position so menu stays in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const el = menuRef.current;
      if (rect.right > window.innerWidth) {
        el.style.left = `${window.innerWidth - rect.width - 4}px`;
      }
      if (rect.bottom > window.innerHeight) {
        el.style.top = `${window.innerHeight - rect.height - 4}px`;
      }
    }
  }, [position]);

  if (!node) {
    return null;
  }

  const validChildren = getInsertableKinds(node);
  const isRoot = schema?.id === node.id;

  // Determine valid siblings: look at parent's insertable kinds,
  // but disable Insert After for groups that must be unique under a record.
  let validSiblings: InsertableKind[] = [];
  if (!isRoot && schema) {
    const parentEntry = findParent(schema, node.id);
    if (parentEntry) {
      validSiblings = getSiblingInsertableKinds(parentEntry.parent, node);
    }
  }

  const canInsertChild = validChildren.length > 0;
  const canInsertSibling = validSiblings.length > 0;
  const canDelete = !isRoot;
  const canMove = !isRoot;

  const handleInsertChild = (kind: InsertableKind) => {
    addChildNode(position.nodeId, kind);
    onClose();
  };

  const handleInsertSibling = (kind: InsertableKind) => {
    addSiblingAfter(position.nodeId, kind);
    onClose();
  };

  const handleDelete = () => {
    deleteNode(position.nodeId);
    onClose();
  };

  const handleMoveUp = () => {
    moveNodeUp(position.nodeId);
    onClose();
  };

  const handleMoveDown = () => {
    moveNodeDown(position.nodeId);
    onClose();
  };

  const openSubMenu = useCallback((menu: 'child' | 'sibling', e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setSubMenuPos({ x: rect.right, y: rect.top });
    setSubMenu(menu);
  }, []);

  return (
    <div ref={menuRef} className="fixed z-50" style={{ left: position.x, top: position.y }}>
      {/* Main menu */}
      <div className="min-w-[180px] py-1 bg-background border border-border rounded-md shadow-lg text-sm">
        {/* Insert Child */}
        {canInsertChild && (
          <div
            className="relative"
            onMouseEnter={e => openSubMenu('child', e)}
            onMouseLeave={() => subMenu === 'child' && setSubMenu(null)}
          >
            <MenuItem
              icon={<Plus size={14} />}
              label="Insert Child"
              suffix={<ChevronRight size={12} className="text-muted-foreground" />}
            />
            {subMenu === 'child' && (
              <SubMenu position={subMenuPos} kinds={validChildren} onSelect={handleInsertChild} />
            )}
          </div>
        )}

        {/* Insert After (sibling) */}
        {canInsertSibling && (
          <div
            className="relative"
            onMouseEnter={e => openSubMenu('sibling', e)}
            onMouseLeave={() => subMenu === 'sibling' && setSubMenu(null)}
          >
            <MenuItem
              icon={<Plus size={14} />}
              label="Insert After"
              suffix={<ChevronRight size={12} className="text-muted-foreground" />}
            />
            {subMenu === 'sibling' && (
              <SubMenu position={subMenuPos} kinds={validSiblings} onSelect={handleInsertSibling} />
            )}
          </div>
        )}

        {(canInsertChild || canInsertSibling) && <MenuSeparator />}

        {/* Move Up / Down */}
        {canMove && (
          <>
            <MenuItem icon={<ArrowUp size={14} />} label="Move Up" onClick={handleMoveUp} />
            <MenuItem icon={<ArrowDown size={14} />} label="Move Down" onClick={handleMoveDown} />
            <MenuSeparator />
          </>
        )}

        {/* Delete */}
        {canDelete && <MenuItem icon={<Trash2 size={14} />} label="Delete" onClick={handleDelete} destructive />}
      </div>
    </div>
  );
}

/** A single menu item row. */
function MenuItem({
  icon,
  label,
  onClick,
  suffix,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  suffix?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent ${
        destructive ? 'text-red-600 hover:text-red-700' : ''
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {suffix}
    </div>
  );
}

/** Horizontal separator. */
function MenuSeparator() {
  return <div className="my-1 border-t border-border" />;
}

/** Flyout submenu listing insertable kinds. */
function SubMenu({
  position,
  kinds,
  onSelect,
}: {
  position: { x: number; y: number };
  kinds: InsertableKind[];
  onSelect: (kind: InsertableKind) => void;
}) {
  return (
    <div
      className="fixed z-[51] min-w-[140px] py-1 bg-background border border-border rounded-md shadow-lg text-sm"
      style={{ left: position.x, top: position.y }}
    >
      {kinds.map(kind => (
        <div
          key={kind}
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent"
          onClick={() => onSelect(kind)}
        >
          {insertKindIcon[kind]}
          <span>{insertKindLabel(kind)}</span>
        </div>
      ))}
    </div>
  );
}
