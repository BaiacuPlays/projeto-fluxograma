import React, { useState, useRef, useLayoutEffect } from 'react';
import { NodeData, NodeType } from '../types';
import { TrashIcon, DisconnectIcon, ShapeIcon, ColorPaletteIcon, ChevronRightIcon, StartIcon, ProcessIcon, DecisionIcon, EndIcon, ResetSizeIcon, AddChildIcon } from './Icons';

interface ContextMenuProps {
    x: number;
    y: number;
    node: NodeData;
    onClose: () => void;
    onDelete: (id: string) => void;
    onRemoveConnections: (id: string) => void;
    onChangeType: (id: string, type: NodeType) => void;
    onChangeColor: (id: string, color?: string) => void;
    onResetSize: (id: string) => void;
    onAddChild: (id: string) => void;
}

const nodeTypes: { type: NodeType; label: string; icon: React.ReactNode }[] = [
    { type: 'start', label: 'Início', icon: <StartIcon className="w-5 h-5 text-green-400" /> },
    { type: 'process', label: 'Processo', icon: <ProcessIcon className="w-5 h-5 text-blue-400" /> },
    { type: 'decision', label: 'Decisão', icon: <DecisionIcon className="w-5 h-5 text-purple-400" /> },
    { type: 'end', label: 'Fim', icon: <EndIcon className="w-5 h-5 text-red-400" /> },
];

const colors = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6'];

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, node, onClose, onDelete, onRemoveConnections, onChangeType, onChangeColor, onResetSize, onAddChild }) => {
    const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const [position, setPosition] = useState({ x, y });
    
    useLayoutEffect(() => {
        if (menuRef.current) {
            const menuWidth = menuRef.current.offsetWidth;
            const menuHeight = menuRef.current.offsetHeight;
            const { innerWidth, innerHeight } = window;

            let finalX = x;
            let finalY = y;

            if (x + menuWidth > innerWidth) {
                finalX = innerWidth - menuWidth - 10;
            }
            if (y + menuHeight > innerHeight) {
                finalY = innerHeight - menuHeight - 10;
            }
            setPosition({ x: finalX, y: finalY });
        }
    }, [x, y]);

    const handleAction = (action: () => void) => (e: React.MouseEvent) => {
        e.stopPropagation();
        action();
    };

    const Submenu: React.FC<{ children: React.ReactNode, parentRef: React.RefObject<HTMLLIElement> }> = ({ children, parentRef }) => {
        const submenuRef = useRef<HTMLDivElement>(null);
        const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });

        useLayoutEffect(() => {
            if (parentRef.current && submenuRef.current) {
                const parentRect = parentRef.current.getBoundingClientRect();
                const subMenuWidth = submenuRef.current.offsetWidth;
                const subMenuHeight = submenuRef.current.offsetHeight;

                let left = parentRect.width - 2; // Position to the right by default
                if(parentRect.right + subMenuWidth > window.innerWidth) {
                    left = -subMenuWidth + 2; // Flip to the left if not enough space
                }

                let top = -8;
                if (parentRect.top + subMenuHeight > window.innerHeight) {
                    top = parentRect.height - subMenuHeight; // Align bottom of submenu with bottom of parent li
                }

                setStyle({ top: `${top}px`, left: `${left}px`, opacity: 1 });
            }
        }, [parentRef]);
        
        return (
            <div ref={submenuRef} style={style} className="absolute bg-[var(--color-bg-tertiary)] rounded-md shadow-2xl p-2 z-20 border border-[var(--color-border)] transition-opacity">
                {children}
            </div>
        )
    };
    
    const shapeSubmenuRef = useRef<HTMLLIElement>(null);
    const colorSubmenuRef = useRef<HTMLLIElement>(null);

    return (
        <div
            ref={menuRef}
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
            className="absolute z-50 w-56 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-lg shadow-xl border border-[var(--color-border)] p-2 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            <ul className="space-y-1">
                 <li ref={shapeSubmenuRef} className="relative" onMouseEnter={() => setOpenSubmenu('shape')} onMouseLeave={() => setOpenSubmenu(null)}>
                    <button className="flex items-center w-full text-left p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                        <ShapeIcon className="w-5 h-5 mr-3" />
                        <span className="flex-grow">Mudar Formato</span>
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                    {openSubmenu === 'shape' && (
                        <Submenu parentRef={shapeSubmenuRef}>
                            <ul className="space-y-1 w-40">
                                {nodeTypes.map(item => (
                                    <li key={item.type}>
                                        <button onClick={handleAction(() => onChangeType(node.id, item.type))} className="flex items-center w-full text-left p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                                            {item.icon}
                                            <span className="ml-3">{item.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </Submenu>
                    )}
                </li>

                 <li ref={colorSubmenuRef} className="relative" onMouseEnter={() => setOpenSubmenu('color')} onMouseLeave={() => setOpenSubmenu(null)}>
                    <button className="flex items-center w-full text-left p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                        <ColorPaletteIcon className="w-5 h-5 mr-3" />
                        <span className="flex-grow">Mudar Cor</span>
                        <ChevronRightIcon className="w-4 h-4" />
                    </button>
                    {openSubmenu === 'color' && (
                         <Submenu parentRef={colorSubmenuRef}>
                             <div className="p-1 w-32">
                                 <div className="grid grid-cols-3 gap-2 mb-2">
                                     {colors.map(color => (
                                         <button key={color} onClick={handleAction(() => onChangeColor(node.id, color))} className="w-8 h-8 rounded-full border-2 border-transparent hover:border-white transition-all" style={{ backgroundColor: color }} />
                                     ))}
                                 </div>
                                 <button onClick={handleAction(() => onChangeColor(node.id, undefined))} className="w-full text-xs p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                                     Restaurar Padrão
                                 </button>
                             </div>
                         </Submenu>
                    )}
                </li>

                <li>
                    <button onClick={handleAction(() => onResetSize(node.id))} className="flex items-center w-full text-left p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                        <ResetSizeIcon className="w-5 h-5 mr-3" />
                        <span>Redefinir Tamanho</span>
                    </button>
                </li>

                <li>
                    <button onClick={handleAction(() => onAddChild(node.id))} className="flex items-center w-full text-left p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                        <AddChildIcon className="w-5 h-5 mr-3" />
                        <span>Adicionar Bloco Filho</span>
                    </button>
                </li>
                
                <div className="h-px bg-[var(--color-border)] my-1"></div>

                <li>
                    <button onClick={handleAction(() => onRemoveConnections(node.id))} className="flex items-center w-full text-left p-2 rounded-md hover:bg-[var(--color-bg-tertiary-hover)] transition-colors duration-150">
                        <DisconnectIcon className="w-5 h-5 mr-3" />
                        <span>Remover Conexões</span>
                    </button>
                </li>
                <li>
                    <button onClick={handleAction(() => onDelete(node.id))} className="flex items-center w-full text-left p-2 rounded-md hover:bg-red-500/20 text-red-400 transition-colors duration-150">
                        <TrashIcon className="w-5 h-5 mr-3" />
                        <span>Deletar Bloco</span>
                    </button>
                </li>
            </ul>
        </div>
    );
};

export default ContextMenu;