import React, { useState } from 'react';

const PRESET_PATIENTS = {
  highRisk: {
    name: "Patient A (High Risk - CRKP Suspected)",
    age: 68,
    gender: "Male",
    icuDays: 12,
    ventilatorDays: 8,
    centralLineDays: 10,
    temperature: 38.9,
    wbcCount: 16.5,
    crpLevel: 145,
    currentAntibiotics: "Meropenem, Vancomycin",
    priorAntibiotics: "Ceftriaxone (7 days in previous ward)",
    clinicalNotes: "Patient exhibits persistent fever, purulent endotracheal secretions, and hemodynamic instability despite broad-spectrum carbapenem coverage."
  },
  moderateRisk: {
    name: "Patient B (Moderate Risk - MRSA / Pseudomonas)",
    age: 54,
    gender: "Female",
    icuDays: 5,
    ventilatorDays: 3,
    centralLineDays: 4,
    temperature: 37.8,
    wbcCount: 11.2,
    crpLevel: 62,
    currentAntibiotics: "Cefepime",
    priorAntibiotics: "Amoxicillin-Clavulanate",
    clinicalNotes: "Post-abdominal surgery patient with mild leukocytosis and new catheter-associated urinary discomfort."
  },
  lowRisk: {
    name: "Patient C (Low Risk - Routine Post-Op Monitoring)",
    age: 42,
    gender: "Male",
    icuDays: 2,
    ventilatorDays: 0,
    centralLineDays: 2,
    temperature: 36.8,
    wbcCount: 7.4,
    crpLevel: 12,
    currentAntibiotics: "Cefazolin (Prophylactic)",
    priorAntibiotics: "None",
    clinicalNotes: "Elective neurosurgery post-op monitoring. Hemodynamically stable, extubated, afebrile."
  }
};

export default function App() {
  const [formData, setFormData] = useState(PRESET_PATIENTS.highRisk);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const loadPreset = (presetKey) => {
    setFormData(PRESET_PATIENTS[presetKey]);
    setAnalysis(null);
    setError(null);
  };

  const generateAssessment = async () => {
    setLoading(true);
    setError(null);

    const systemPrompt = `You are ICU-Shield AI, an advanced clinical decision support engine for Intensive Care Units (ICU). 
Analyze the provided ICU patient data to evaluate the risk of multidrug-resistant organism (MDRO / Superbug) healthcare-associated infection and antibiotic resistance.

Patient Data:
- Age/Gender: ${formData.age} / ${formData.gender}
- ICU Length of Stay: ${formData.icuDays} days
- Mechanical Ventilation Duration: ${formData.ventilatorDays} days
- Central Line Duration: ${formData.centralLineDays} days
- Body Temperature: ${formData.temperature} °C
- WBC Count: ${formData.wbcCount} x10^3/µL
- CRP Level: ${formData.crpLevel} mg/L
- Current Antibiotics: ${formData.currentAntibiotics}
- Prior Antibiotics (Last 90 days): ${formData.priorAntibiotics}
- Clinical Notes: ${formData.clinicalNotes}

Provide your structured clinical assessment strictly in JSON format matching this schema:
{
  "riskScore": number (0 to 100),
  "riskCategory": string ("HIGH RISK", "MODERATE RISK", "LOW RISK"),
  "suspectedPathogens": [string],
  "predictedResistances": [
    { "class": string, "risk": string ("High" | "Moderate" | "Low"), "mechanism": string }
  ],
  "clinicalRationale": string,
  "actionableRecommendations": [string],
  "recommendedDiagnostics": [string]
}
Return ONLY valid JSON without markdown code fences or extra text.`;

    try {
      if (apiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (!response.ok) throw new Error('API Request failed. Check API key.');
        const data = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        setAnalysis(JSON.parse(jsonText));
      } else {
        await new Promise(res => setTimeout(res, 1000));
        
        const temp = parseFloat(formData.temperature);
        const wbc = parseFloat(formData.wbcCount);
        const crp = parseFloat(formData.crpLevel);
        const ventDays = parseInt(formData.ventilatorDays) || 0;

        let score = Math.min(98, Math.max(15, 
          (ventDays * 4) + (formData.icuDays * 2) + (temp > 38 ? 15 : 0) + (wbc > 12 ? 15 : 0) + (crp > 50 ? 20 : 0)
        ));

        let category = score > 70 ? "HIGH RISK" : score > 40 ? "MODERATE RISK" : "LOW RISK";

        setAnalysis({
          riskScore: Math.round(score),
          riskCategory: category,
          suspectedPathogens: score > 70 
            ? ["Carbapenem-Resistant Klebsiella pneumoniae (CRKP)", "Pseudomonas aeruginosa", "Acinetobacter baumannii"]
            : score > 40 
            ? ["Methicillin-Resistant Staphylococcus aureus (MRSA)", "Extended-Spectrum Beta-Lactamase (ESBL) E. coli"]
            : ["Routine post-operative microbial colonization"],
          predictedResistances: score > 70 ? [
            { class: "Carbapenems (Meropenem/Imipenem)", risk: "High", mechanism: "KPC / NDM Carbapenemase production" },
            { class: "3rd/4th Gen Cephalosporins", risk: "High", mechanism: "Plasmid-mediated ESBL" },
            { class: "Fluoroquinolones", risk: "High", mechanism: "gyrA/parC mutations" }
          ] : [
            { class: "Penicillins / Ampicillin", risk: "Moderate", mechanism: "Standard beta-lactamase" }
          ],
          clinicalRationale: `Calculated high probability of nosocomial superbug infection driven by extended invasive device days (Ventilator: ${ventDays}d, Central Line: ${formData.centralLineDays}d), persistent elevation of inflammatory biomarkers (CRP: ${crp} mg/L, WBC: ${wbc}), and ongoing broad-spectrum antibiotic selection pressure.`,
          actionableRecommendations: [
            "Initiate immediate contact isolation precautions.",
            "Consider escalation/stewardship adjustment to Colistin/Tigecycline or Ceftazidime-Avibactam pending cultures.",
            "De-escalate or remove invasive intravascular lines if clinically feasible."
          ],
          recommendedDiagnostics: [
            "Rapid Multiplex PCR for Carbapenemase genes (blaKPC, blaNDM, blaOXA-48)",
            "Endotracheal Aspirate Quantitative Culture & Antimicrobial Susceptibility Testing (AST)",
            "Paired Blood Cultures (Central vs Peripheral)"
          ]
        });
      }
    } catch (err) {
      setError(err.message || 'Error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif', padding: '24px' }}>
      
      {/* Header */}
      <header style={{ borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyBetween: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#38bdf8' }}>🛡️ ICU-Shield AI</h1>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            Clinical Decision Support for Superbug Infection & AMR Risk Prediction
          </p>
        </div>
        <div>
          <input 
            type="password" 
            placeholder="Optional Gemini API Key (Demo Mode if empty)" 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)}
            style={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: 'white', padding: '8px 12px', borderRadius: '6px', width: '280px', fontSize: '12px' }}
          />
        </div>
      </header>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Left Form */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>LOAD PRESETS:</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => loadPreset('highRisk')} style={{ backgroundColor: '#7f1d1d', color: '#fca5a5', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🔴 High Risk</button>
              <button onClick={() => loadPreset('moderateRisk')} style={{ backgroundColor: '#78350f', color: '#fcd34d', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🟡 Moderate</button>
              <button onClick={() => loadPreset('lowRisk')} style={{ backgroundColor: '#064e3b', color: '#6ee7b7', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🟢 Low Risk</button>
            </div>
          </div>

          <h2 style={{ fontSize: '18px', color: '#38bdf8', marginTop: 0 }}>📋 Patient Parameters</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label>Age:</label>
                <input type="number" name="age" value={formData.age} onChange={handleInputChange} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Gender:</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} style={inputStyle}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label>ICU Days:</label>
                <input type="number" name="icuDays" value={formData.icuDays} onChange={handleInputChange} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label>Ventilator Days:</label>
                <input type="number" name="ventilatorDays" value={formData.ventilatorDays} onChange={handleInputChange} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label>Temp (°C):</label>
                <input type="number" step="0.1" name="temperature" value={formData.temperature} onChange={handleInputChange} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label>WBC Count:</label>
                <input type="number" step="0.1" name="wbcCount" value={formData.wbcCount} onChange={handleInputChange} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label>CRP Level:</label>
                <input type="number" name="crpLevel" value={formData.crpLevel} onChange={handleInputChange} style={inputStyle} />
              </div>
            </div>

            <div>
              <label>Current Antibiotics:</label>
              <input type="text" name="currentAntibiotics" value={formData.currentAntibiotics} onChange={handleInputChange} style={inputStyle} />
            </div>

            <div>
              <label>Prior Antibiotics (90 Days):</label>
              <input type="text" name="priorAntibiotics" value={formData.priorAntibiotics} onChange={handleInputChange} style={inputStyle} />
            </div>

            <div>
              <label>Clinical Notes:</label>
              <textarea name="clinicalNotes" rows="3" value={formData.clinicalNotes} onChange={handleInputChange} style={{ ...inputStyle, resize: 'none' }} />
            </div>

            <button 
              onClick={generateAssessment} 
              disabled={loading}
              style={{ backgroundColor: '#0284c7', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '8px' }}
            >
              {loading ? "⚡ Analyzing Data..." : "🧠 Execute AI Assessment"}
            </button>
          </div>
        </div>

        {/* Right Output */}
        <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
          {error && <div style={{ color: '#f87171', padding: '10px', backgroundColor: '#450a0a', borderRadius: '6px' }}>{error}</div>}

          {!analysis && !loading && (
            <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
              <p style={{ fontSize: '40px', margin: 0 }}>🩺</p>
              <h3>Awaiting Patient Evaluation</h3>
              <p style={{ fontSize: '13px' }}>Click "Execute AI Assessment" or choose a preset scenario.</p>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', color: '#38bdf8', marginTop: '60px' }}>
              <h3>⚡ AI Engine is Evaluating Biomarkers & Exposure History...</h3>
            </div>
          )}

          {analysis && !loading && (
            <div>
              {/* Risk Header */}
              <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', marginBottom: '16px', borderLeft: `6px solid ${analysis.riskCategory === 'HIGH RISK' ? '#ef4444' : analysis.riskCategory === 'MODERATE RISK' ? '#f59e0b' : '#10b981'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, color: analysis.riskCategory === 'HIGH RISK' ? '#ef4444' : analysis.riskCategory === 'MODERATE RISK' ? '#f59e0b' : '#10b981' }}>
                    {analysis.riskCategory}
                  </h2>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                    Score: {analysis.riskScore}/100
                  </div>
                </div>
                <p style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '10px' }}>
                  <strong>Rationale:</strong> {analysis.clinicalRationale}
                </p>
              </div>

              {/* Suspected Pathogens */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ color: '#c084fc', marginBottom: '6px' }}>👾 Suspected Pathogens:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#e2e8f0' }}>
                  {analysis.suspectedPathogens.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>

              {/* Resistances */}
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ color: '#f87171', marginBottom: '6px' }}>💊 Predicted Resistances:</h4>
                {analysis.predictedResistances.map((item, i) => (
                  <div key={i} style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px', marginBottom: '6px', fontSize: '12px' }}>
                    <strong style={{ color: '#fca5a5' }}>{item.class}</strong> - Risk: {item.risk}
                    <div style={{ color: '#94a3b8' }}>Mechanism: {item.mechanism}</div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div>
                <h4 style={{ color: '#2dd4bf', marginBottom: '6px' }}>✅ Stewardship Action Plan:</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#e2e8f0' }}>
                  {analysis.actionableRecommendations.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  backgroundColor: '#0f172a',
  border: '1px solid #475569',
  color: 'white',
  padding: '8px',
  borderRadius: '6px',
  marginTop: '4px',
  boxSizing: 'border-box'
};