import React, { useRef } from 'react';
import { NodeData, NodeType } from '../types';
import { StartIcon, ProcessIcon, DecisionIcon, EndIcon, AddIcon, DownloadIcon, UploadIcon, TrashIcon } from './Icons';

interface SidebarProps {
  setNodes: React.Dispatch<React.SetStateAction<NodeData[]>>;
  autoConnect: boolean;
  setAutoConnect: React.Dispatch<React.SetStateAction<boolean>>;
  onExportPNG: () => void;
  onExportJSON: () => void;
  onImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

const nodeTypeText: Record<NodeType, string> = {
    start: 'Início',
    process: 'Novo Processo',
    decision: 'Nova Decisão',
    end: 'Fim',
};

const ActionButton: React.FC<{ text: string, icon: React.ReactNode, onClick: () => void }> = ({ text, icon, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center w-full p-3 text-left bg-[#2d3748] hover:bg-[#4a5568] rounded-lg transition-all duration-200 shadow-sm border border-transparent hover:border-[#5a6578] transform hover:scale-105"
    >
        <div className="w-6 h-6 mr-4 flex-shrink-0 flex items-center justify-center">{icon}</div>
        <span className="flex-grow font-medium text-sm">{text}</span>
    </button>
);

const DangerActionButton: React.FC<{ text: string, icon: React.ReactNode, onClick: () => void }> = ({ text, icon, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center w-full p-3 text-left bg-red-900/70 hover:bg-red-800/80 text-red-300 hover:text-red-100 rounded-lg transition-all duration-200 shadow-sm border border-red-700/80 hover:border-red-600 transform hover:scale-105"
    >
        <div className="w-6 h-6 mr-4 flex-shrink-0 flex items-center justify-center">{icon}</div>
        <span className="flex-grow font-medium text-sm">{text}</span>
    </button>
);


const NodeButton: React.FC<{ type: NodeType, text: string, icon: React.ReactNode, onClick: () => void }> = ({ text, icon, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center w-full p-3 text-left bg-[#2d3748] hover:bg-[#4a5568] rounded-lg transition-all duration-200 shadow-sm border border-transparent hover:border-[#5a6578] transform hover:scale-105"
        >
            <div className="w-8 h-8 mr-4 flex-shrink-0 flex items-center justify-center">{icon}</div>
            <span className="flex-grow font-medium">{text}</span>
            <AddIcon className="w-6 h-6 text-gray-400" />
        </button>
    )
}

const Sidebar: React.FC<SidebarProps> = ({ setNodes, autoConnect, setAutoConnect, onExportPNG, onExportJSON, onImportJSON, onClear }) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const addNode = (type: NodeType) => {
    const newNode: NodeData = {
      id: `${type}-${Date.now()}`,
      type,
      text: nodeTypeText[type],
      position: { x: Math.random() * 200 + 50, y: Math.random() * 100 + 50 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  return (
    <div className="flex-grow overflow-y-auto p-4 border-t border-[#374151] custom-scrollbar">
      <h2 className="text-lg font-semibold mb-4 text-gray-300">Adicionar Blocos</h2>
      <div className="space-y-3">
        <NodeButton 
            text="Início" 
            type="start"
            icon={<StartIcon className="text-green-400" />} 
            onClick={() => addNode('start')} 
        />
        <NodeButton 
            text="Processo" 
            type="process"
            icon={<ProcessIcon className="text-blue-400" />} 
            onClick={() => addNode('process')} 
        />
        <NodeButton 
            text="Decisão" 
            type="decision"
            icon={<DecisionIcon className="text-purple-400" />} 
            onClick={() => addNode('decision')} 
        />
        <NodeButton 
            text="Fim" 
            type="end"
            icon={<EndIcon className="text-red-400" />} 
            onClick={() => addNode('end')} 
        />
      </div>

       <div className="mt-6 pt-4 border-t border-[#374151]">
          <h3 className="text-base font-semibold mb-3 text-gray-300">Ações</h3>
          <div className="space-y-3">
              <ActionButton 
                  text="Exportar para PNG"
                  icon={<DownloadIcon className="text-cyan-300" />}
                  onClick={onExportPNG}
              />
              <ActionButton 
                  text="Exportar para JSON"
                  icon={<DownloadIcon className="text-cyan-300" />}
                  onClick={onExportJSON}
              />
               <ActionButton 
                  text="Importar de JSON"
                  icon={<UploadIcon className="text-cyan-300" />}
                  onClick={handleImportClick}
              />
               <input
                  type="file"
                  ref={importInputRef}
                  className="hidden"
                  accept=".json,application/json"
                  onChange={onImportJSON}
              />
          </div>
      </div>

       <div className="mt-6 pt-4 border-t border-red-500/30">
          <h3 className="text-base font-semibold mb-3 text-red-400">Zona de Perigo</h3>
          <div className="space-y-3">
               <DangerActionButton 
                  text="Limpar Tudo"
                  icon={<TrashIcon className="w-5 h-5" />}
                  onClick={onClear}
              />
          </div>
      </div>

       <div className="mt-6 pt-4 border-t border-[#374151]">
          <h3 className="text-base font-semibold mb-3 text-gray-300">Configurações</h3>
          <div className="flex items-center justify-between">
              <label htmlFor="auto-connect-toggle" className="font-medium text-sm text-gray-200 cursor-pointer">
                  Conexão Automática
                  <p className="text-xs text-gray-400 font-normal mt-1">Ajustar setas ao mover blocos</p>
              </label>
              <button
                  role="switch"
                  aria-checked={autoConnect}
                  id="auto-connect-toggle"
                  onClick={() => setAutoConnect(prev => !prev)}
                  className={`${autoConnect ? 'bg-cyan-500' : 'bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#1F2937]`}
              >
                  <span
                      aria-hidden="true"
                      className={`${autoConnect ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
              </button>
          </div>
      </div>
    </div>
  );
};

export default Sidebar;