import React, { useState } from 'react';

interface AiPanelProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
  error: string | null;
}

const AiPanel: React.FC<AiPanelProps> = ({ onGenerate, isLoading, error }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt);
    }
  };

  return (
    <div className="p-4 flex-grow flex flex-col">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <label htmlFor="prompt" className="mb-2 font-semibold text-gray-300">
          Descreva seu processo
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="flex-grow p-3 bg-[#111827] border border-[#374151] rounded-md focus:ring-2 focus:ring-[#22D3EE] focus:border-[#22D3EE] transition-all duration-200 resize-none placeholder-gray-500"
          placeholder="Ex: 'Um usuário faz login. Se for bem-sucedido, ele vai para o painel. Caso contrário, uma mensagem de erro é exibida.'"
          rows={6}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="mt-4 w-full bg-[#0891B2] hover:bg-[#0E7490] disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition-all duration-200 flex items-center justify-center shadow-lg transform hover:scale-105"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Gerando...
            </>
          ) : (
            'Gerar Fluxograma com IA'
          )}
        </button>
        {error && <p className="mt-3 text-sm text-red-300 bg-red-900/60 p-3 rounded-md transition-all">{error}</p>}
      </form>
    </div>
  );
};

export default AiPanel;