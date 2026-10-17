import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
import httpx
from app.core.config import settings

logger = logging.getLogger("farmconnect-ai-service")


class AIService:
    """
    Modular AI Service layer interfacing with Anthropic Claude API.
    Handles timeouts, rate limits, input validation, robust fallbacks,
    and strict guardrails (communicating uncertainty, deterministic arithmetic).
    """

    def __init__(self):
        self.anthropic_key = settings.ANTHROPIC_API_KEY
        self.anthropic_model = settings.ANTHROPIC_MODEL
        self.gemini_key = settings.GEMINI_API_KEY
        self.gemini_model = settings.GEMINI_MODEL
        self.omniroute_key = settings.OMNIROUTE_API_KEY
        self.omniroute_base_url = settings.OMNIROUTE_BASE_URL.rstrip("/")
        self.omniroute_model = settings.OMNIROUTE_MODEL
        self.timeout = settings.AI_REQUEST_TIMEOUT_SECONDS
        self.max_tokens = settings.AI_MAX_TOKENS

    def has_active_api_key(self) -> bool:
        for k in [self.omniroute_key, self.gemini_key, self.anthropic_key]:
            if k and k.strip() and not k.startswith("your_"):
                return True
        return False

    async def _call_llm(
        self,
        system_prompt: str,
        user_content: Union[str, List[Dict[str, Any]]],
        temperature: float = 0.2,
    ) -> str:
        """
        Execute call to configured AI Provider:
        1. OmniRoute (OpenAI-compatible AI Gateway)
        2. Google Gemini REST API
        3. Anthropic Claude API
        """
        # Extract plain text if user_content has multimodal structure
        if isinstance(user_content, str):
            user_text = user_content
        else:
            text_chunks = [c.get("text", "") for c in user_content if c.get("type") == "text"]
            user_text = " ".join(text_chunks)

        # 1. OmniRoute Provider
        if self.omniroute_key and self.omniroute_key.strip() and not self.omniroute_key.startswith("your_"):
            omni_url = f"{self.omniroute_base_url}/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.omniroute_key.strip()}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.omniroute_model or "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text},
                ],
                "temperature": temperature,
                "max_tokens": self.max_tokens,
            }
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                resp = await client.post(omni_url, headers=headers, json=payload)
                if resp.is_success:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()

        # 2. Google Gemini Provider
        if self.gemini_key and self.gemini_key.strip() and not self.gemini_key.startswith("your_"):
            gemini_url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
                f"?key={self.gemini_key.strip()}"
            )
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\n{user_text}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": self.max_tokens,
                },
            }
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                resp = await client.post(gemini_url, json=payload)
                if resp.is_success:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()

        # 3. Anthropic Claude Provider
        if self.anthropic_key and self.anthropic_key.strip() and not self.anthropic_key.startswith("your_"):
            headers = {
                "x-api-key": self.anthropic_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            }
            messages = [{"role": "user", "content": user_content if isinstance(user_content, list) else user_text}]
            payload = {
                "model": self.anthropic_model,
                "max_tokens": self.max_tokens,
                "temperature": temperature,
                "system": system_prompt,
                "messages": messages,
            }
            async with httpx.AsyncClient(timeout=float(self.timeout)) as client:
                resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
                if resp.is_success:
                    data = resp.json()
                    content_blocks = data.get("content", [])
                    text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
                    return "".join(text_parts).strip()

        raise RuntimeError("No configured AI provider succeeded; invoking deterministic regional engine.")

    # Maintain alias for compatibility
    _call_claude = _call_llm

    # =========================================================================
    # A. FarmForensics — Crop Pathology Investigation
    # =========================================================================
    async def analyze_crop_pathology(
        self,
        crop_name: str,
        symptoms_description: str,
        affected_percentage: Optional[float] = None,
        irrigation_details: Optional[str] = None,
        image_base64: Optional[str] = None,
        image_media_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """
        Analyze crop pathology using Claude.
        Strict rule: Clearly communicate uncertainty; do not present as confirmed diagnosis.
        """
        system_prompt = (
            "You are an expert agricultural plant pathologist specializing in the coastal Karnataka agro-climatic "
            "zone (Dakshina Kannada and Udupi). Crops include Arecanut (Chali/Bette), Paddy, Black Pepper, Coconut, "
            "Cashew, and GI Udupi Mattu Gulla. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. You must ALWAYS clearly communicate diagnostic uncertainty. Do NOT state a diagnosis as absolute fact.\n"
            "2. Identify 2 to 3 possible causes with likelihood ratings (e.g. 'Probable', 'Possible', 'Unlikely').\n"
            "3. Provide practical, field-level 'recommended_next_checks' (what to look for on leaves, collar, roots, soil moisture).\n"
            "4. Suggest non-chemical cultural practices or safe bio-agent remedies (e.g. Trichoderma, Bordeaux mixture, good drainage).\n"
            "5. Always include an explicit disclaimer advising farmer consultation with local KVK Brahmavar / Mangalore.\n"
            "6. Output must be strictly valid JSON matching this schema:\n"
            "{\n"
            '  "preliminary_diagnosis": "string",\n'
            '  "confidence_score": 0.0 to 1.0,\n'
            '  "urgency": "low" | "medium" | "high",\n'
            '  "possible_causes": [\n'
            '    {"cause": "string", "likelihood": "Probable" | "Possible", "details": "string"}\n'
            "  ],\n"
            '  "recommended_next_checks": ["string"],\n'
            '  "remedies": ["string"],\n'
            '  "disclaimer": "string"\n'
            "}"
        )

        user_text = (
            f"Crop: {crop_name}\n"
            f"Observed Symptoms: {symptoms_description}\n"
            f"Estimated Affected Area: {affected_percentage or 'Unspecified'}%\n"
            f"Irrigation & Soil Details: {irrigation_details or 'Coastal Laterite / Rainfed'}\n"
            "Please provide a preliminary differential investigation."
        )

        if image_base64:
            user_content = [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image_media_type,
                        "data": image_base64,
                    },
                },
                {"type": "text", "text": user_text},
            ]
        else:
            user_content = user_text

        # Try Anthropic API if key is present
        if self.has_active_api_key():
            try:
                response_text = await self._call_claude(system_prompt, user_content)
                # Parse JSON
                json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(0))
            except Exception as e:
                logger.warning(f"Anthropic API call failed ({e}), falling back to regional deterministic pathology engine.")

        # Fallback: Expert regional deterministic agronomic pathology model
        return self._fallback_crop_pathology(crop_name, symptoms_description, affected_percentage, irrigation_details)

    def _fallback_crop_pathology(
        self,
        crop_name: str,
        symptoms: str,
        affected_percentage: Optional[float] = None,
        irrigation_details: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Deterministic, expert regional pathology engine for Dakshina Kannada & Udupi crops.
        Used when API key is missing or unavailable, or for offline validation.
        """
        c_lower = crop_name.lower()
        s_lower = symptoms.lower()

        if "areca" in c_lower or "ಅಡಿಕೆ" in c_lower or "betel" in c_lower:
            if "rot" in s_lower or "drop" in s_lower or "shed" in s_lower or "fruit" in s_lower or "ಕೊಳೆ" in s_lower:
                diag = "Suspected Koleroga / Mahali (Phytophthora meadii Fruit Rot)"
                urgency = "high"
                confidence = 0.88
                causes = [
                    {"cause": "Phytophthora meadii (Fruit Rot Fungus)", "likelihood": "Probable", "details": "Active during heavy southwest monsoon spells with prolonged humidity."},
                    {"cause": "Bacterial Nut Splitting", "likelihood": "Possible", "details": "Can occur due to sudden water uptake after dry spells."},
                ]
                checks = [
                    "Inspect fallen immature nuts for dark water-soaked lesions near perianth.",
                    "Check crown canopy for white mycelial felt growth on bunch stalks.",
                    "Verify if drainage channels around palms are waterlogged.",
                ]
                remedies = [
                    "Collect and deeply bury or destroy all fallen infected nuts to prevent spore circulation.",
                    "Tie polythene/Alkathene hoods over bunches before heavy monsoon onset.",
                    "Spray 1% neutral Bordeaux mixture on bunches during rain-free sunshine breaks.",
                ]
            elif "yellow" in s_lower or "leaf" in s_lower:
                diag = "Suspected Yellow Leaf Disease (YLD) / Nutrient Deficiency"
                urgency = "medium"
                confidence = 0.75
                causes = [
                    {"cause": "Yellow Leaf Disease (Phytoplasma)", "likelihood": "Probable", "details": "Transmitted by Proutista moesta planthoppers in coastal plantations."},
                    {"cause": "Magnesium / Zinc Deficiency", "likelihood": "Possible", "details": "Common in heavily leached acidic laterite soils of Dakshina Kannada."},
                ]
                checks = [
                    "Observe whether yellowing starts from innermost whorls (YLD) or older bottom fronds (deficiency).",
                    "Check kernel consistency; YLD causes soft, blackish-brown sponge kernels.",
                ]
                remedies = [
                    "Apply recommended dose of micronutrients (Zinc sulphate + Magnesium sulphate).",
                    "Plant shade companion crops like banana and cocoa to buffer root stress.",
                ]
            else:
                diag = "Suspected Foliar Spot or Root Grubs"
                urgency = "medium"
                confidence = 0.70
                causes = [{"cause": "Anomala beetle root grub", "likelihood": "Possible", "details": "Damages feeder roots in sandy-laterite soils."}]
                checks = ["Dig 1 foot around palm basin to inspect for C-shaped white grubs."]
                remedies = ["Incorporate neem cake (2 kg/palm) into basin soil."]
        elif "pepper" in c_lower or "ಮೆಣಸು" in c_lower:
            diag = "Suspected Quick Wilt / Foot Rot (Phytophthora capsici)"
            urgency = "high"
            confidence = 0.85
            causes = [
                {"cause": "Phytophthora capsici", "likelihood": "Probable", "details": "Soil-borne oomycete spreading in wet soil."},
                {"cause": "Slow Decline (Nematode + Fusarium complex)", "likelihood": "Possible", "details": "Causes progressive yellowing over months."},
            ]
            checks = [
                "Scrape root collar near ground level to check for black necrosis.",
                "Sniff root basin; Phytophthora produces foul water-soaked decay without hollow pith.",
            ]
            remedies = [
                "Ensure zero water stagnation at vine base; provide drainage slope.",
                "Apply biocontrol Trichoderma harzianum enriched compost at root collar.",
                "Drench root basin with 1% Bordeaux mixture or Copper Hydroxide.",
            ]
        elif "mattu gulla" in c_lower or "brinjal" in c_lower or "eggplant" in c_lower:
            diag = "Suspected Shoot and Fruit Borer (Leucinodes orbonalis)"
            urgency = "medium"
            confidence = 0.82
            causes = [
                {"cause": "Leucinodes orbonalis", "likelihood": "Probable", "details": "Primary pest of Solanaceous crops in Udupi coastal belts."},
                {"cause": "Bacterial Wilt (Ralstonia solanacearum)", "likelihood": "Possible", "details": "Rapid wilting of entire green plant without prior yellowing."},
            ]
            checks = [
                "Examine wilted terminal shoots for small entry boreholes with frass.",
                "Conduct stem water glass test to observe white bacterial ooze threads if wilting occurs.",
            ]
            remedies = [
                "Clip and destroy affected drooping shoots along with larvae.",
                "Install pheromone traps (Lucinlure) @ 12 traps/acre.",
                "Spray Neem Seed Kernel Extract (NSKE 5%) at weekly intervals.",
            ]
        else:
            diag = "Suspected Anthracnose or Fungal Leaf Spot Complex"
            urgency = "medium"
            confidence = 0.72
            causes = [
                {"cause": "Colletotrichum / Cercospora fungal species", "likelihood": "Probable", "details": "Favored by coastal warmth and leaf wetness."},
                {"cause": "Potassium / Micronutrient imbalance", "likelihood": "Possible", "details": "Marginal chlorosis on older leaves."},
            ]
            checks = ["Examine lesion margins for concentric rings or yellow chlorotic halos."]
            remedies = [
                "Improve plant spacing and prune diseased leaves to increase airflow.",
                "Apply bio-fungicide Pseudomonas fluorescens (20g/L water).",
            ]

        return {
            "preliminary_diagnosis": diag,
            "confidence_score": confidence,
            "urgency": urgency,
            "possible_causes": causes,
            "recommended_next_checks": checks,
            "remedies": remedies,
            "disclaimer": (
                "Important Uncertainty Notice: This is an AI-assisted preliminary observation based on provided symptoms, "
                "not a confirmed microbiological or laboratory diagnosis. Visual symptoms can overlap across viral, fungal, "
                "and nutrient deficiencies. Consult the Brahmavar Zonal Agricultural & Horticultural Research Station or "
                "local KVK officers before investing in chemical treatments."
            ),
        }

    # =========================================================================
    # B. FarmLab — Farming Experiment Synthesis
    # =========================================================================
    async def synthesize_experiment(
        self,
        experiment_title: str,
        crop_tested: str,
        hypothesis: str,
        control_method: str,
        experimental_method: str,
        duration_days: int,
        metrics_summary: List[Dict[str, Any]],
    ) -> Dict[str, str]:
        """
        Explain farming experiment results using Claude.
        Strict rule: Do not invent measurements or claim small trial proves general efficacy.
        Highlight limitations and outline logical next trials.
        """
        system_prompt = (
            "You are a scientific agronomist advising smallholder marginal farmers on small-scale field trials. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. You must analyze ONLY the provided numerical differences calculated deterministically by the system. Do NOT fabricate numbers.\n"
            "2. NEVER claim that a small-plot experiment proves broad scientific effectiveness or guarantees results.\n"
            "3. Explicitly state limitations: plot size, lack of replications, soil heterogeneity, monsoon rainfall anomalies.\n"
            "4. Provide constructive next trial suggestions (e.g. testing in dry season, testing half-dosage, expanding to 5 more palms).\n"
            "5. Output valid JSON with keys: 'synthesis_summary', 'limitations_summary', 'next_experiment_suggestions'."
        )

        metrics_text = "\n".join([
            f"- {m.get('metric_name')}: Control = {m.get('control_value')}, "
            f"Experimental = {m.get('experimental_value')}, "
            f"Delta = {m.get('difference')} ({m.get('percentage_change')}%)"
            for m in metrics_summary
        ])

        user_prompt = (
            f"Experiment: {experiment_title}\n"
            f"Crop: {crop_tested}\n"
            f"Hypothesis: {hypothesis}\n"
            f"Control Practice: {control_method}\n"
            f"Experimental Practice: {experimental_method}\n"
            f"Trial Duration: {duration_days} days\n"
            f"Recorded Deterministic Metrics:\n{metrics_text}\n\n"
            "Please synthesize these results with scientific prudence."
        )

        if self.has_active_api_key():
            try:
                response_text = await self._call_claude(system_prompt, user_prompt)
                json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(0))
            except Exception as e:
                logger.warning(f"Anthropic API call failed ({e}), falling back to deterministic synthesis engine.")

        # Fallback deterministic synthesis
        best_metric = metrics_summary[0] if metrics_summary else {"metric_name": "Yield", "percentage_change": 0.0}
        pct = best_metric.get("percentage_change", 0.0)
        direction = "increase" if pct > 0 else "reduction"

        synthesis = (
            f"In this {duration_days}-day trial on {crop_tested}, the experimental plot ({experimental_method}) "
            f"showed a {abs(pct):.1f}% {direction} in {best_metric.get('metric_name')} compared to the standard "
            f"practice ({control_method}). While these initial figures are encouraging for the tested plot, "
            "small-scale tests reflect localized soil and microclimate responses."
        )

        limitations = (
            "Trial Limitations: This investigation was conducted on a single small plot without randomized replications. "
            "Natural variations in coastal rainfall, subsoil laterite depth, and adjacent shade trees could account "
            "for part of the observed difference. General effectiveness across the entire farm cannot be assumed."
        )

        next_steps = (
            f"Recommended Next Trial: 1) Replicate the trial across 3 separate rows in different quadrants of the farm. "
            f"2) Monitor soil organic matter and moisture retention during the upcoming dry season. "
            f"3) Track input expenditure per kilogram of harvest to confirm net profitability."
        )

        return {
            "synthesis_summary": synthesis,
            "limitations_summary": limitations,
            "next_experiment_suggestions": next_steps,
        }

    # =========================================================================
    # C. AI Price Assistant — Market Benchmarking & Advice
    # =========================================================================
    async def explain_price_comparison(
        self,
        crop_name: str,
        asking_price: float,
        unit: str,
        district: str,
        taluk: str,
        reference_data: Optional[Dict[str, Any]],
        difference: Optional[float],
        pct_difference: Optional[float],
    ) -> str:
        """
        Explain price positioning relative to official APMC Mandi benchmarks.
        Strict rule: Never fabricate market prices; explicitly communicate when no benchmark exists.
        """
        if not reference_data:
            return (
                f"Market Reference Data Unavailable: No official APMC Mandi or cooperative benchmark is currently "
                f"recorded in the regional database for {crop_name} in {district} ({taluk}). "
                "Because prices depend heavily on daily arrival volumes, moisture content, and grade, "
                "FarmConnect AI will not estimate or fabricate a market price. Please verify current rates with "
                "your local APMC yard or CAMPCO / cooperative branch before finalizing your asking price."
            )

        system_prompt = (
            "You are a trusted agricultural pricing advisor for marginal farmers in Dakshina Kannada & Udupi. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. You must analyze ONLY the provided asking price, Mandi benchmark, and mathematically pre-calculated percentage differences.\n"
            "2. NEVER invent current prices, guarantee future earnings, or promise guaranteed profit margins.\n"
            "3. Provide balanced advice: If asking price is higher than Mandi modal price, explain how the farmer can justify "
            "the premium to direct buyers (e.g. freshness, zero middleman transit delays, organic or GI authenticity). "
            "If lower, caution the farmer against underpricing high-grade produce.\n"
            "4. Keep the explanation concise, encouraging, and clear."
        )

        user_prompt = (
            f"Crop: {crop_name}\n"
            f"Farmer's Asking Price: ₹{asking_price:.2f} per {unit}\n"
            f"Official Reference Mandi Modal Price: ₹{reference_data.get('modal_price', 0):.2f} per {unit}\n"
            f"Reference Price Range: ₹{reference_data.get('min_price', 0):.2f} to ₹{reference_data.get('max_price', 0):.2f}\n"
            f"Calculated Delta: ₹{difference:+.2f} ({pct_difference:+.1f}% vs Modal Mandi Price)\n"
            f"Market Yard: {reference_data.get('market_yard')}\n"
            f"Data Source: {reference_data.get('data_source')}\n"
            f"Observation Date: {reference_data.get('as_of_date')}\n"
            "Explain this positioning simply to the farmer."
        )

        if self.has_active_api_key():
            try:
                return await self._call_claude(system_prompt, user_prompt, temperature=0.3)
            except Exception as e:
                logger.warning(f"Anthropic API call failed ({e}), using deterministic pricing explanation.")

        # Fallback explanation
        modal = reference_data.get("modal_price", asking_price)
        yard = reference_data.get("market_yard", "APMC Yard")
        diff_val = difference or 0.0
        pct_val = pct_difference or 0.0

        if abs(pct_val) < 3.0:
            return (
                f"Your asking price of ₹{asking_price:.2f}/{unit} closely aligns with the prevailing Mandi modal rate "
                f"of ₹{modal:.2f}/{unit} observed at {yard}. This competitive parity makes your listing attractive "
                "to local restaurants and retail aggregators seeking fair direct-from-farm pricing without broker fees."
            )
        elif diff_val > 0:
            return (
                f"Your asking price of ₹{asking_price:.2f}/{unit} is ₹{diff_val:.2f} (+{pct_val:.1f}%) above the "
                f"regional Mandi modal rate (₹{modal:.2f}/{unit} at {yard}). Direct buyers often pay this premium "
                "if you highlight farm-fresh harvesting within 24 hours, superior sorting/grading, or organic cultivation. "
                "Ensure your listing notes describe these quality advantages clearly to justify the higher asking price."
            )
        else:
            return (
                f"Your asking price of ₹{asking_price:.2f}/{unit} is ₹{abs(diff_val):.2f} ({pct_val:.1f}%) below the "
                f"Mandi modal benchmark of ₹{modal:.2f}/{unit} at {yard}. While a lower price ensures rapid sales, "
                "make sure you are not undercutting your production and labor costs. If your produce meets standard "
                "grade criteria, consider pricing closer to ₹{modal:.2f}/{unit} to maximize your farm returns."
            )

    # =========================================================================
    # D. Kannada Voice-Based Listing Extraction
    # =========================================================================
    async def extract_listing_from_kannada(
        self,
        transcript_kannada: str,
        farmer_taluk: Optional[str] = "Bantwal",
        farmer_district: Optional[str] = "Dakshina Kannada",
    ) -> Dict[str, Any]:
        """
        Parse Kannada speech transcript into structured, editable produce listing fields.
        Strict rule: Farmer must review and confirm extracted values before publishing.
        """
        system_prompt = (
            "You are a specialized linguistic parser extracting farm produce sales listings from spoken Kannada. "
            "You recognize regional coastal Karnataka agricultural terms: "
            "ಅಡಿಕೆ (Arecanut / Chali), ಮೆಣಸು (Black Pepper), ಮತ್ತಗುಳ್ಳ (Udupi Mattu Gulla), ತೆಂಗಿನಕಾಯಿ (Coconut), "
            "ಕೆಂಪಕ್ಕಿ (Red Rice), ಬಾಳೆಹಣ್ಣು (Banana), ತರಕಾರಿ (Vegetables), ಬೆಂಡೆಕಾಯಿ (Okra), ಬದನೆಕಾಯಿ (Brinjal). "
            "CRITICAL INSTRUCTIONS:\n"
            "1. Extract the produce name, numeric quantity, unit (kg, quintal, nut, atte), unit asking price (₹), "
            "taluk, and variety.\n"
            "2. Translate produce name to standard English while preserving the Kannada title in 'crop_kannada'.\n"
            "3. If a field is omitted in the voice input, assign a reasonable default from coastal Karnataka context.\n"
            "4. Return strictly valid JSON matching this schema:\n"
            "{\n"
            '  "crop_name": "string (English)",\n'
            '  "crop_kannada": "string",\n'
            '  "category": "Plantation Crops" | "Vegetables" | "Spices" | "Cereals" | "Fruits",\n'
            '  "quantity": number,\n'
            '  "unit": "kg" | "quintal" | "nut" | "atte",\n'
            '  "price_per_unit": number,\n'
            '  "district": "string",\n'
            '  "taluk": "string",\n'
            '  "quality_grade": "Grade A (Premium)" | "Grade B",\n'
            '  "confidence_score": 0.0 to 1.0,\n'
            '  "english_summary": "string"\n'
            "}"
        )

        user_prompt = (
            f"Spoken Kannada Transcript: \"{transcript_kannada}\"\n"
            f"Farmer Location Context: Taluk: {farmer_taluk or 'Bantwal'}, District: {farmer_district or 'Dakshina Kannada'}\n"
            "Extract structured produce listing draft."
        )

        if self.has_active_api_key():
            try:
                response_text = await self._call_claude(system_prompt, user_prompt, temperature=0.1)
                json_match = re.search(r"\{.*\}", response_text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                    # Sanitize and validate
                    if parsed.get("quantity", 0) > 0 and parsed.get("price_per_unit", 0) > 0:
                        return parsed
            except Exception as e:
                logger.warning(f"Anthropic API call failed ({e}), falling back to deterministic regex parser.")

        # Fallback: Robust deterministic regex/keyword parser for Kannada transcripts
        return self._fallback_kannada_parser(transcript_kannada, farmer_taluk, farmer_district)

    def _fallback_kannada_parser(
        self,
        text: str,
        farmer_taluk: Optional[str] = "Bantwal",
        farmer_district: Optional[str] = "Dakshina Kannada",
    ) -> Dict[str, Any]:
        """
        Deterministic parser for Kannada speech transcripts.
        """
        lower = text.lower()

        # Identify crop
        if "ಅಡಿಕೆ" in text or "areca" in lower or "chali" in lower:
            crop = "Arecanut (Chali)"
            crop_kn = "ಅಡಿಕೆ (ಚಾಲಿ)"
            category = "Plantation Crops"
            default_price = 450.0
            default_unit = "kg"
        elif "ಗುಳ್ಳ" in text or "gulla" in lower or "mattu" in lower:
            crop = "Udupi Mattu Gulla"
            crop_kn = "ಉಡುಪಿ ಮಟ್ಟುಗುಳ್ಳ"
            category = "Vegetables"
            default_price = 60.0
            default_unit = "kg"
        elif "ಮೆಣಸು" in text or "pepper" in lower:
            crop = "Black Pepper"
            crop_kn = "ಕಾಳು ಮೆಣಸು"
            category = "Spices"
            default_price = 610.0
            default_unit = "kg"
        elif "ತೆಂಗಿನಕಾಯಿ" in text or "coconut" in lower:
            crop = "Coconut"
            crop_kn = "ತೆಂಗಿನಕಾಯಿ"
            category = "Plantation Crops"
            default_price = 22.0
            default_unit = "nut"
        elif "ಟೊಮೆಟೊ" in text or "ಟೊಮ್ಯಾಟೊ" in text or "tomato" in lower:
            crop = "Tomato"
            crop_kn = "ಟೊಮೆಟೊ"
            category = "Vegetables"
            default_price = 28.0
            default_unit = "kg"
        elif "ಬದನೆ" in text or "brinjal" in lower or "eggplant" in lower:
            crop = "Brinjal (Eggplant)"
            crop_kn = "ಬದನೆಕಾಯಿ"
            category = "Vegetables"
            default_price = 35.0
            default_unit = "kg"
        else:
            crop = "Mixed Coastal Farm Produce"
            crop_kn = "ಸ್ಥಳೀಯ ತೋಟದ ಬೆಳೆ"
            category = "Vegetables"
            default_price = 40.0
            default_unit = "kg"

        # Extract numbers for quantity and price
        # Find all integer or float numbers
        numbers = re.findall(r"\b\d+(?:\.\d+)?\b", text)
        qty = 100.0
        price = default_price

        if len(numbers) >= 2:
            qty = float(numbers[0])
            price = float(numbers[1])
        elif len(numbers) == 1:
            qty = float(numbers[0])

        # Unit extraction
        unit = default_unit
        if "ಕ್ವಿಂಟಾಲ್" in text or "quintal" in lower:
            unit = "quintal"
        elif "ಕಾಯಿ" in text or "nut" in lower:
            unit = "nut"
        elif "ಕೆಜಿ" in text or "kg" in lower or "ಕಿಲೊ" in text:
            unit = "kg"

        # Location extraction
        taluk = farmer_taluk or "Bantwal"
        for t in ["Bantwal", "Mangalore", "Puttur", "Belthangady", "Sullia", "Udupi", "Kundapura", "Karkala"]:
            if t.lower() in lower:
                taluk = t
                break

        return {
            "crop_name": crop,
            "crop_kannada": crop_kn,
            "category": category,
            "quantity": qty,
            "unit": unit,
            "price_per_unit": price,
            "district": farmer_district or "Dakshina Kannada",
            "taluk": taluk,
            "quality_grade": "Grade A (Premium)",
            "confidence_score": 0.90,
            "english_summary": f"Voice listing draft generated: {qty:.1f} {unit} of {crop} at ₹{price:.2f}/{unit} in {taluk}. Review before publishing.",
        }


# Singleton AI service instance
ai_service = AIService()
