/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  ChevronRight, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle2, 
  UserPlus, 
  Stethoscope, 
  Database,
  BarChart3,
  BrainCircuit,
  Info
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";
import { FoodItem, Participant, AnalysisResult, AppStep } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [step, setStep] = useState<AppStep>('setup');
  const [foods, setFoods] = useState<FoodItem[]>([
    { id: '1', name: 'Salade de pommes de terre' },
    { id: '2', name: 'Poulet rôti' },
    { id: '3', name: 'Mayonnaise maison' }
  ]);
  const [newFoodName, setNewFoodName] = useState('');
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newParticipantName, setNewParticipantName] = useState('');
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Actions ---
  const addFood = () => {
    if (!newFoodName.trim()) return;
    setFoods([...foods, { id: Math.random().toString(36).substr(2, 9), name: newFoodName.trim() }]);
    setNewFoodName('');
  };

  const removeFood = (id: string) => {
    setFoods(foods.filter(f => f.id !== id));
    // Also remove from participants
    setParticipants(participants.map(p => ({
      ...p,
      foodsEaten: p.foodsEaten.filter(fid => fid !== id)
    })));
  };

  const addParticipant = () => {
    if (!newParticipantName.trim()) return;
    setParticipants([
      ...participants, 
      { 
        id: Math.random().toString(36).substr(2, 9), 
        name: newParticipantName.trim(), 
        isSick: false, 
        foodsEaten: [] 
      }
    ]);
    setNewParticipantName('');
  };

  const toggleSick = (id: string) => {
    setParticipants(participants.map(p => 
      p.id === id ? { ...p, isSick: !p.isSick } : p
    ));
  };

  const toggleFoodForParticipant = (pId: string, fId: string) => {
    setParticipants(participants.map(p => {
      if (p.id !== pId) return p;
      const alreadyEaten = p.foodsEaten.includes(fId);
      return {
        ...p,
        foodsEaten: alreadyEaten 
          ? p.foodsEaten.filter(id => id !== fId) 
          : [...p.foodsEaten, fId]
      };
    }));
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };

  // --- Epidemiology Logic ---
  const results = useMemo(() => {
    return foods.map(food => {
      const exposed = participants.filter(p => p.foodsEaten.includes(food.id));
      const unexposed = participants.filter(p => !p.foodsEaten.includes(food.id));
      
      const sickExposed = exposed.filter(p => p.isSick).length;
      const totalExposed = exposed.length;
      
      const sickUnexposed = unexposed.filter(p => p.isSick).length;
      const totalUnexposed = unexposed.length;
      
      const arExposed = totalExposed > 0 ? (sickExposed / totalExposed) : 0;
      const arUnexposed = totalUnexposed > 0 ? (sickUnexposed / totalUnexposed) : 0;
      
      // Risk Ratio (Relative Risk)
      let riskRatio = 0;
      if (arUnexposed === 0) {
        riskRatio = arExposed > 0 ? 999 : 0;
      } else {
        riskRatio = arExposed / arUnexposed;
      }

      return {
        foodId: food.id,
        foodName: food.name,
        attackRateExposed: arExposed,
        attackRateUnexposed: arUnexposed,
        riskRatio
      };
    }).sort((a, b) => b.riskRatio - a.riskRatio);
  }, [foods, participants]);

  // --- AI Analysis ---
  const runAiAnalysis = async () => {
    if (participants.length === 0) return;
    setIsAiLoading(true);
    setAiAnalysis(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const topFood = results[0];
      
      const prompt = `
        En tant qu'expert en épidémiologie et sécurité alimentaire, analyse ces données d'intoxication alimentaire :
        
        SITUATON :
        - Nombre total de convives : ${participants.length}
        - Nombre de malades : ${participants.filter(p => p.isSick).length}
        - Aliment le plus suspect : "${topFood.foodName}" 
          * Taux d'attaque chez ceux qui l'ont mangé : ${(topFood.attackRateExposed * 100).toFixed(1)}%
          * Taux d'attaque chez ceux qui ne l'ont pas mangé : ${(topFood.attackRateUnexposed * 100).toFixed(1)}%
          * Risque Relatif : ${topFood.riskRatio === 999 ? 'Infini (Seuls ceux qui ont mangé cet aliment sont malades)' : topFood.riskRatio.toFixed(2)}
        
        RÉSULTATS DÉTAILLÉS :
        ${results.map(r => `- ${r.foodName}: RR=${r.riskRatio.toFixed(2)}, AR_Exp=${(r.attackRateExposed * 100).toFixed(0)}%, AR_Unexp=${(r.attackRateUnexposed * 100).toFixed(0)}%`).join('\n')}

        OBJECTIF :
        1. Confirme si le coupable semble être "${topFood.foodName}".
        2. Suggère quels pathogènes pourraient être en cause (Salmonella, Staph doré, Campylobacter, etc.) basés sur l'aliment suspect.
        3. Donne des conseils rapides sur la conduite à tenir (hydratation, consulter un médecin si signes de gravité).
        
        Réponds de manière concise, professionnelle et bienveillante en Français. Utilise du Markdown pour la structure.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiAnalysis(response.text || "Impossible d'analyser les données pour le moment.");
    } catch (err) {
      console.error(err);
      setAiAnalysis("Une erreur est survenue lors de l'analyse IA. Vérifiez vos données.");
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'results' && !aiAnalysis && !isAiLoading) {
      runAiAnalysis();
    }
  }, [step]);

  // --- Render Steps ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-xl tracking-tight">IntoxiCheck</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {[
              { id: 'setup', icon: Database, label: 'Aliments' },
              { id: 'participants', icon: UserPlus, label: 'Convives' },
              { id: 'results', icon: BarChart3, label: 'Analyse' }
            ].map((s, idx) => (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(s.id as AppStep)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all font-medium",
                    step === s.id ? "text-indigo-600 border-b-2 border-indigo-600 rounded-none py-5" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <s.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {idx < 2 && <span className="mx-2 text-slate-200">/</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {step === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <div className="mb-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Composants du repas</h2>
                  <h3 className="text-2xl font-bold text-slate-900">Qu'avez-vous mangé ?</h3>
                </div>

                <div className="flex gap-4 mb-8">
                  <input 
                    type="text" 
                    value={newFoodName}
                    onChange={(e) => setNewFoodName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addFood()}
                    placeholder="Ex: Tiramisu maison, Salade..."
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  />
                  <button 
                    onClick={addFood}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm shadow-indigo-200"
                  >
                    <Plus className="w-5 h-5" /> Ajouter
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {foods.map((food) => (
                    <motion.div 
                      layout
                      key={food.id}
                      className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="font-medium text-slate-700">{food.name}</span>
                      </div>
                      <button 
                        onClick={() => removeFood(food.id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                  {foods.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                      <p className="text-slate-400">Aucun aliment n'a encore été ajouté.</p>
                    </div>
                  )}
                </div>
              </section>

              <div className="flex justify-end">
                <button 
                  onClick={() => setStep('participants')}
                  disabled={foods.length === 0}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-3 transition-all hover:bg-opacity-90 disabled:opacity-50"
                >
                  Continuer vers les convives <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'participants' && (
            <motion.div 
              key="participants"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm overflow-x-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Convives & Diagnostic</h2>
                    <h3 className="text-2xl font-bold text-slate-900">Suivi des participants</h3>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addParticipant()}
                      placeholder="Nom..."
                      className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-indigo-500 transition-all outline-none text-sm"
                    />
                    <button 
                      onClick={addParticipant}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left pb-4 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-400">Status</th>
                      <th className="text-left pb-4 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-400">Nom</th>
                      {foods.map(food => (
                        <th key={food.id} className="text-center pb-4 px-2 font-bold text-[10px] uppercase tracking-wider text-slate-400">
                          {food.name}
                        </th>
                      ))}
                      <th className="pb-4 px-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {participants.map((p) => (
                      <tr key={p.id} className="group transition-all hover:bg-slate-50/50">
                        <td className="py-4 px-4">
                          <button 
                            onClick={() => toggleSick(p.id)}
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all border",
                              p.isSick 
                                ? "bg-rose-50 text-rose-600 border-rose-100" 
                                : "bg-indigo-50 text-indigo-600 border-indigo-100"
                            )}
                          >
                            {p.isSick ? "Malade" : "Sain"}
                          </button>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-700">{p.name}</td>
                        {foods.map(food => (
                          <td key={food.id} className="py-4 px-2 text-center">
                            <button
                              onClick={() => toggleFoodForParticipant(p.id, food.id)}
                              className={cn(
                                "w-6 h-6 rounded-md flex items-center justify-center transition-all border m-auto",
                                p.foodsEaten.includes(food.id)
                                  ? "bg-indigo-600 border-transparent text-white"
                                  : "bg-white border-slate-200 text-slate-200 hover:border-slate-400"
                              )}
                            >
                              {p.foodsEaten.includes(food.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        ))}
                        <td className="py-4 px-4 text-right">
                          <button 
                            onClick={() => removeParticipant(p.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {participants.length === 0 && (
                      <tr>
                        <td colSpan={foods.length + 4} className="py-16 text-center text-slate-400 italic text-sm">
                          Ajoutez des convives pour démarrer l'analyse.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <div className="flex justify-between items-center bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 text-xs text-slate-400 font-medium italic">
                   <Info className="w-4 h-4 text-indigo-400" />
                   Cochez les aliments consommés par chaque convive.
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStep('setup')}
                    className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                  >
                    Retour
                  </button>
                  <button 
                    onClick={() => setStep('results')}
                    disabled={participants.length === 0}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    Lancer l'analyse
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Statistics Panel */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h2 className="text-3xl font-bold text-slate-900">Analyse de Risque</h2>
                        <p className="text-slate-500 mt-1 text-sm">Calcul du Risque Relatif par ingestion.</p>
                      </div>
                      <div className="bg-rose-50 text-rose-600 px-4 py-2 rounded-full text-[10px] font-bold border border-rose-100 uppercase tracking-widest">
                        Alerte Epidémique
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.map((res, idx) => (
                        <div key={res.foodId} className={cn(
                          "p-6 rounded-2xl border transition-all relative overflow-hidden",
                          idx === 0 && res.riskRatio > 1 
                            ? "border-rose-500 bg-rose-50/30" 
                            : "border-slate-100 bg-white"
                        )}>
                           {idx === 0 && res.riskRatio > 1 && (
                             <div className="absolute top-0 right-0 p-2 bg-rose-500 text-white text-[8px] font-bold uppercase rounded-bl-lg">
                               Probabilité Élevée
                             </div>
                           )}
                           <div className="flex flex-col gap-4">
                             <div>
                               <h3 className={cn("font-bold text-lg mb-1", idx === 0 && res.riskRatio > 1 ? "text-rose-900" : "text-slate-700")}>
                                 {res.foodName}
                               </h3>
                               <p className={cn("text-[10px] font-bold uppercase", idx === 0 && res.riskRatio > 1 ? "text-rose-500" : "text-slate-400")}>
                                 Score RR: {res.riskRatio === 999 ? '∞' : res.riskRatio.toFixed(2)}
                               </p>
                             </div>
                             
                             <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${Math.min(res.riskRatio * 5, 100)}%` }}
                                 className={cn("h-full", idx === 0 && res.riskRatio > 1 ? "bg-rose-500" : "bg-indigo-400")}
                               />
                             </div>

                             <div className="flex justify-between text-[10px] font-bold text-slate-400 italic">
                               <span>Exposés: {(res.attackRateExposed * 100).toFixed(0)}% Malades</span>
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-slate-900 p-6 rounded-2xl text-white">
                      <p className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-1">Convives</p>
                      <div className="text-3xl font-black">{participants.length}</div>
                    </div>
                    <div className="bg-rose-500 p-6 rounded-2xl text-white shadow-lg shadow-rose-200">
                      <p className="text-[10px] uppercase opacity-60 font-bold tracking-widest mb-1">Symptomatiques</p>
                      <div className="text-3xl font-black">{participants.filter(p => p.isSick).length}</div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1">Taux Global</p>
                      <div className="text-3xl font-black text-slate-900">
                        {participants.length > 0 ? ((participants.filter(p => p.isSick).length / participants.length) * 100).toFixed(0) : 0}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Analysis Panel */}
                <div className="lg:col-span-4">
                  <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-100">
                        <BrainCircuit className="w-5 h-5" />
                      </div>
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Diagnostic IA</h2>
                    </div>

                    <div className="flex-1">
                      {isAiLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-3 bg-slate-50 rounded-full animate-pulse" style={{ width: `${Math.random() * 40 + 60}%` }} />
                          ))}
                        </div>
                      ) : aiAnalysis ? (
                        <div className="prose prose-slate prose-xs leading-relaxed text-slate-600 font-medium">
                          {aiAnalysis}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                           <p className="text-slate-300 text-sm italic">Analyse en attente...</p>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={runAiAnalysis}
                      disabled={isAiLoading}
                      className="mt-8 w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50"
                    >
                      <RotateCcw className={cn("w-4 h-4", isAiLoading && "animate-spin")} />
                      Recalculer
                    </button>
                  </section>
                </div>
              </div>

              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => {
                    if (window.confirm("Tout réinitialiser ?")) {
                      setStep('setup');
                      setParticipants([]);
                      setAiAnalysis(null);
                    }
                  }}
                  className="px-6 py-2 border border-slate-200 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:border-slate-400 hover:text-slate-600 transition-all"
                >
                  Nouvelle Enquête
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-slate-100 mt-12 text-center">
        <p className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">
          Aide à l'investigation épidémiologique • IA Assistée
        </p>
      </footer>
    </div>
  );
}
