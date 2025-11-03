import { GoogleGenAI, Type } from "@google/genai";
import { FlowchartData, NodeData, EdgeData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const flowchartSchema = {
    type: Type.OBJECT,
    properties: {
        nodes: {
            type: Type.ARRAY,
            description: "Uma lista de todos os blocos (nós) no fluxograma.",
            items: {
                type: Type.OBJECT,
                properties: {
                    id: {
                        type: Type.STRING,
                        description: "Um identificador único para o nó (ex: 'node-1').",
                    },
                    type: {
                        type: Type.STRING,
                        description: