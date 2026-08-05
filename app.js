const SUPABASE_URL = "https://kwxgaoyjbkawerguljtx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3eGdhb3lqYmthd2VyZ3VsanR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDI1MTAsImV4cCI6MjA5NzM3ODUxMH0.v39YkkhMsfwBJwPWbSdDjqHRozV9h6FdEhtM5KxakVI";

/* ============================================================
   PRIVATE WEBSITE VISITOR TRACKING
============================================================ */

const trackWebsiteVisitor = async () => {
  try {
    const visitorStorageKey =
      "hoblemercy_visitor_id";

    let visitorId =
      localStorage.getItem(
        visitorStorageKey
      );

    /*
      Create a privacy-friendly random browser ID.
      No name, email, phone or IP address is stored here.
    */

    if (!visitorId) {
      visitorId =
        typeof crypto?.randomUUID ===
        "function"
          ? crypto.randomUUID()
          : `visitor-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 15)}`;

      localStorage.setItem(
        visitorStorageKey,
        visitorId
      );
    }

    const pagePath =
      window.location.pathname ||
      "/";

    const referrer =
      document.referrer || null;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/track_site_visit`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          apikey:
            SUPABASE_ANON_KEY,

          Authorization:
            `Bearer ${SUPABASE_ANON_KEY}`
        },

        body: JSON.stringify({
          p_visitor_id:
            visitorId,

          p_page_path:
            pagePath,

          p_referrer:
            referrer
        }),

        /*
          Do not delay the page when the visitor
          moves to another page.
        */
        keepalive: true
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.warn(
        "Visitor tracking failed:",
        errorText
      );
    }

  } catch (error) {
    /*
      Analytics should never break the website.
    */

    console.warn(
      "Visitor analytics error:",
      error
    );
  }
};


/*
  Track after the main content has loaded.
*/

if (
  document.readyState === "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    trackWebsiteVisitor,
    {
      once: true
    }
  );
} else {
  trackWebsiteVisitor();
}
const EDGE_FUNCTION_NAME = "send-assessment-notification";

// Loaded lazily from the Supabase JS CDN build so this file stays
// dependency-free until the user actually needs to submit.
let supabaseClient = null;
async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase) {
    await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/* ============================================================
   2. FORM STATE
   ============================================================ */
const TOTAL_STEPS = 9;
const STORAGE_KEY = "hoblemercy_assessment_draft_v1";

const state = {
  currentStep: 1, // 1..9, then "preview", then "result"
  view: "hero", // "hero" | "form" | "preview" | "result"
  answers: {
    // Step 1
    fullName: "", businessName: "", phone: "", email: "",
    preferredContact: "", state: "", city: "", address: "", socialLink: "",
    // Step 2
    businessType: "", businessTypeOther: "", businessDescription: "",
    targetCustomers: [], businessAge: "", teamSize: "", registrationStatus: "",
    // Step 3
    branding: {}, brandFeeling: "",
    // Step 4
    platforms: [], online: {}, onlineProblem: "",
    // Step 5
    postFrequency: "", contentTypes: [], marketing: {}, marketingChallenge: "",
    // Step 6
    contactChannels: [], replySpeed: "", comms: {}, commonQuestions: "",
    // Step 7
    sellsType: "", orderChannels: [], sales: {},
    productCount: "", product: {}, service: {}, orderJourney: "",
    // Step 8
    manualTasks: [], dailyEnquiries: "", automation: {}, timeStress: "",
    // Step 9
    mainGoal: "", improvementGoals: [], biggestChallenge: "",
    previousAttempts: "", successDefinition: "", budgetRange: "",
    timeline: "", readinessLevel: "", finalNarration: "",
    consentContact: false, consentFollowUp: false,
  },
  result: null, // populated after calculateAssessmentScore + recommendations
  submissionToken: null,
  isSubmitting: false,
};

/* ============================================================
   Yes/No question sets (rendered dynamically into .yesno-list containers)
   Each key maps to state.answers.<bucket>.<key> = true|false
   ============================================================ */
const YESNO_SETS = {
  brandingYesNoList: {
    bucket: "branding",
    questions: [
      ["hasLogo", "Do you have a business logo?"],
      ["satisfiedWithLogo", "Are you satisfied with your current logo?"],
      ["hasBrandColours", "Do you have official brand colours?"],
      ["consistentColours", "Do you use the same colours on all your materials?"],
      ["hasBrandFonts", "Do you have official brand fonts?"],
      ["consistentSocialDesign", "Do your social media designs follow the same style?"],
      ["hasBusinessCard", "Do you have a business card?"],
      ["hasLetterhead", "Do you have a letterhead?"],
      ["hasInvoiceDesign", "Do you have an invoice design?"],
      ["hasReceiptDesign", "Do you have a receipt design?"],
      ["hasLabels", "Do you have stickers or product labels?"],
      ["hasPackaging", "Do you have professional packaging?"],
      ["hasCompanyProfile", "Do you have a company profile?"],
      ["hasBrandGuide", "Do you have a brand guide?"],
      ["looksProfessional", "Does your business currently look as professional as you want?"],
    ],
  },
  onlineYesNoList: {
    bucket: "online",
    questions: [
      ["hasBio", "Do you have a professional business bio?"],
      ["bioExplainsOffer", "Does your bio clearly explain what you offer?"],
      ["bioHasCta", "Does your bio contain a clear call-to-action?"],
      ["hasBioLink", "Do you have a bio link page?"],
      ["hasWebsite", "Do you have your own website?"],
      ["websiteMobileFriendly", "Is your website mobile-friendly?"],
      ["websiteShowsAll", "Can customers find all your services or products on your website?"],
      ["hasDomain", "Do you have a professional domain name?"],
      ["hasBusinessEmail", "Do you have a professional business email?"],
      ["listedOnGoogle", "Is your business listed on Google?"],
      ["correctGoogleLocation", "Is your correct location visible on Google Maps?"],
      ["easyToFindContact", "Can customers easily find your phone number and address?"],
      ["getsGoogleEnquiries", "Do you regularly receive enquiries from Google?"],
      ["knowsVisitorCount", "Do you know how many people visit your website or profile?"],
    ],
  },
  marketingYesNoList: {
    bucket: "marketing",
    questions: [
      ["hasPromoGraphics", "Do you have professionally designed promotional graphics?"],
      ["regularlyPromotes", "Do you regularly promote your products or services?"],
      ["createsSaleDesigns", "Do you create special sales or discount designs?"],
      ["usesPromoVideos", "Do you use short promotional videos?"],
      ["clearProductPhotos", "Are your product pictures clear and professional?"],
      ["postsIncludePrices", "Do your posts usually include prices?"],
      ["postsHaveCta", "Do your posts tell customers what to do next?"],
      ["hasContentCalendar", "Do you have a content plan or posting calendar?"],
      ["usesTestimonials", "Do you use customer testimonials?"],
      ["showsBeforeAfter", "Do you show before-and-after results where appropriate?"],
      ["createsSeasonalPromos", "Do you create seasonal promotions?"],
      ["runsAds", "Do you currently run paid advertisements?"],
      ["knowsBestPosts", "Do you know which posts bring the most enquiries?"],
    ],
  },
  commsYesNoList: {
    bucket: "comms",
    questions: [
      ["usesWhatsAppBusiness", "Do you use WhatsApp Business?"],
      ["completeCatalogue", "Is your WhatsApp catalogue complete?"],
      ["usesQuickReplies", "Do you use quick replies?"],
      ["hasWelcomeMessage", "Do you have an automatic welcome message?"],
      ["hasAwayMessage", "Do you have an away message?"],
      ["displaysHours", "Do you display your business hours?"],
      ["repeatedQuestions", "Do customers often ask the same questions repeatedly?"],
      ["hasPriceList", "Do you have a service catalogue or price list?"],
      ["collectsReviews", "Do you regularly collect customer reviews?"],
      ["displaysTestimonials", "Do you publicly display testimonials?"],
      ["followsUpEnquiry", "Do you follow up with customers after an enquiry?"],
      ["followsUpSale", "Do you follow up after a sale?"],
      ["hasLoyaltySystem", "Do you have a loyalty or reward system?"],
      ["customersStopReplying", "Do customers sometimes stop replying before completing an order?"],
      ["hasLoyaltyProgram", "Do you have a loyalty or reward system? (duplicate check)"],
      ["keepsEnquiryRecords", "Do you keep records of customer enquiries?"],
      ["knowsReferralSource", "Do you know where most customers heard about your business?"],
    ],
  },
  salesYesNoList: {
    bucket: "sales",
    questions: [
      ["catalogueVisible", "Can customers see all products or services before contacting you?"],
      ["pricesDisplayed", "Are your prices clearly displayed?"],
      ["orderOnline", "Can customers place orders online?"],
      ["bookOnline", "Can customers book appointments online?"],
      ["autoOrderConfirmation", "Do customers receive automatic order confirmation?"],
      ["autoBookingConfirmation", "Do customers receive booking confirmation?"],
      ["appointmentReminders", "Do customers receive reminders before appointments?"],
      ["payOnline", "Can customers pay online?"],
      ["bankTransfer", "Do you offer bank transfer?"],
      ["providesReceipts", "Do you provide payment receipts?"],
      ["paymentConfirmation", "Do customers receive payment confirmation?"],
      ["tracksOrderProgress", "Do you track order progress?"],
      ["deliveryUpdates", "Do customers receive delivery updates?"],
      ["tracksStock", "Do you track product stock or inventory?"],
      ["usesCoupons", "Do you use coupons or discount codes?"],
      ["hasCustomerDashboard", "Do you have a customer account or dashboard?"],
      ["hasAbandonedOrders", "Do you experience abandoned orders?"],
      ["orderingStressful", "Is your ordering process currently stressful or time-consuming?"],
    ],
  },
  productYesNoList: {
    bucket: "product",
    questions: [
      ["clearPictures", "Do products have clear pictures?"],
      ["hasDescriptions", "Do products have descriptions?"],
      ["hasPrices", "Do products have prices?"],
      ["needsInventory", "Do you need inventory management?"],
      ["needsDeliveryTracking", "Do you need delivery tracking?"],
    ],
  },
  serviceYesNoList: {
    bucket: "service",
    questions: [
      ["needsBooking", "Do you need appointment booking?"],
      ["needsTimeSlots", "Do you need time-slot selection?"],
      ["needsConsultationScheduling", "Do you need consultation scheduling?"],
      ["needsAutoReminders", "Do you need automatic reminders?"],
    ],
  },
  automationYesNoList: {
    bucket: "automation",
    questions: [
      ["losesToSlowReplies", "Do you lose customers because of slow replies?"],
      ["repeatedQuestionsTime", "Do you spend too much time answering repeated questions?"],
      ["forgetsFollowUp", "Do you forget to follow up with some customers?"],
      ["manualInvoices", "Do you manually send invoices or receipts?"],
      ["manualBookingConfirm", "Do you manually confirm bookings?"],
      ["manualStockUpdate", "Do you manually update stock?"],
      ["manualUpdates", "Do you manually send email or WhatsApp updates?"],
      ["wantsAutoMessages", "Would you like customers to receive automatic messages?"],
      ["wantsChatbot", "Would you like an AI chatbot to answer common questions?"],
      ["wantsAutoReminders", "Would you like automatic appointment reminders?"],
      ["wantsAutoFollowUp", "Would you like automatic customer follow-ups?"],
      ["wantsAdminDashboard", "Would you like an admin dashboard to manage enquiries?"],
      ["wantsReports", "Would you like reports showing enquiries, sales or customer activity?"],
      ["usesManagementSoftware", "Are you currently using any business management software?"],
      ["openToAutomation", "Are you comfortable introducing automation gradually?"],
    ],
  },
};

/* ============================================================
   3. LOCALSTORAGE HELPERS
   ============================================================ */
/* ============================================================
   3. ASSESSMENT DRAFT AND PROGRESS
============================================================ */

const DRAFT_EXPIRY_DAYS = 30;

let draftSaveTimer = null;


/*
  Check whether the draft contains any actual user answers.
*/

function hasMeaningfulDraftValue(value) {
  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.values(value).some(
      hasMeaningfulDraftValue
    );
  }

  return false;
}


/*
  Save the current visible step before writing the draft.
*/

function saveDraft() {
  try {
    if (
      typeof state.currentStep === "number"
    ) {
      readStepIntoState(
        state.currentStep
      );
    }

    if (
      !hasMeaningfulDraftValue(
        state.answers
      )
    ) {
      return;
    }

    const payload = {
      version: 2,

      currentStep:
        state.currentStep,

      answers:
        state.answers,

      savedAt:
        new Date().toISOString(),

      expiresAt:
        new Date(
          Date.now() +
          DRAFT_EXPIRY_DAYS *
            24 *
            60 *
            60 *
            1000
        ).toISOString()
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(payload)
    );

  } catch (error) {
    console.warn(
      "Could not save assessment draft:",
      error
    );
  }
}


/*
  Avoid writing to localStorage after every single keystroke.
*/

function scheduleDraftSave() {
  window.clearTimeout(
    draftSaveTimer
  );

  draftSaveTimer =
    window.setTimeout(
      saveDraft,
      500
    );
}


/*
  Restore nested answer objects safely.
*/

function restoreDraft() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return false;
    }

    const payload =
      JSON.parse(raw);

    if (
      !payload ||
      !payload.answers
    ) {
      clearDraft();
      return false;
    }

    /*
      Remove drafts older than 30 days.
    */

    if (
      payload.expiresAt &&
      new Date(payload.expiresAt).getTime() <
        Date.now()
    ) {
      clearDraft();
      return false;
    }

    if (
      !hasMeaningfulDraftValue(
        payload.answers
      )
    ) {
      clearDraft();
      return false;
    }

    state.answers = {
      ...state.answers,
      ...payload.answers,

      branding: {
        ...state.answers.branding,
        ...(payload.answers.branding || {})
      },

      online: {
        ...state.answers.online,
        ...(payload.answers.online || {})
      },

      marketing: {
        ...state.answers.marketing,
        ...(payload.answers.marketing || {})
      },

      comms: {
        ...state.answers.comms,
        ...(payload.answers.comms || {})
      },

      sales: {
        ...state.answers.sales,
        ...(payload.answers.sales || {})
      },

      product: {
        ...state.answers.product,
        ...(payload.answers.product || {})
      },

      service: {
        ...state.answers.service,
        ...(payload.answers.service || {})
      },

      automation: {
        ...state.answers.automation,
        ...(payload.answers.automation || {})
      }
    };

    const restoredStep =
      payload.currentStep;

    if (
      restoredStep === "preview" ||
      (
        Number.isInteger(
          Number(restoredStep)
        ) &&
        Number(restoredStep) >= 1 &&
        Number(restoredStep) <= TOTAL_STEPS
      )
    ) {
      state.currentStep =
        restoredStep === "preview"
          ? "preview"
          : Number(restoredStep);
    } else {
      state.currentStep = 1;
    }

    return true;

  } catch (error) {
    console.warn(
      "Could not restore assessment draft:",
      error
    );

    clearDraft();

    return false;
  }
}


function clearDraft() {
  try {
    localStorage.removeItem(
      STORAGE_KEY
    );
  } catch (error) {
    console.warn(
      "Could not clear assessment draft:",
      error
    );
  }
}


/*
  Save text, select, checkbox and radio changes automatically.
*/

function setupDraftAutoSave() {
  if (!els.form) {
    return;
  }

  els.form.addEventListener(
    "input",
    event => {
      if (
        event.target.id ===
        "websiteHp"
      ) {
        return;
      }

      scheduleDraftSave();
    }
  );

  els.form.addEventListener(
    "change",
    event => {
      if (
        event.target.id ===
        "websiteHp"
      ) {
        return;
      }

      scheduleDraftSave();
    }
  );

  /*
    Save immediately before the visitor leaves.
  */

  window.addEventListener(
    "pagehide",
    saveDraft
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        saveDraft();
      }
    }
  );
}

/* ============================================================
   4. STEP NAVIGATION
   ============================================================ */
const els = {
  hero: document.getElementById("hero"),
  assessmentSection: document.getElementById("assessment"),
  form: document.getElementById("assessmentForm"),
  stepLabel: document.getElementById("stepLabel"),
  progressPercentLabel: document.getElementById("progressPercentLabel"),
  progressBar: document.getElementById("progressBar"),
  progressFill: document.getElementById("progressFill"),
  backBtn: document.getElementById("backBtn"),
  continueBtn: document.getElementById("continueBtn"),
  submitBtn: document.getElementById("submitBtn"),
  previewStep: document.getElementById("previewStep"),
  previewContent: document.getElementById("previewContent"),
  resultStep: document.getElementById("resultStep"),
  resultContent: document.getElementById("resultContent"),
  liveRegion: document.getElementById("liveRegion"),
  startBtn: document.getElementById("startAssessmentBtn"),
};

function getStepEl(stepIdentifier) {
  return els.form.querySelector(`.form-step[data-step="${stepIdentifier}"]`);
}

function showStep(stepIdentifier) {
  document.querySelectorAll(".form-step").forEach((el) => { el.hidden = true; });
  const target = getStepEl(stepIdentifier);
  if (target) target.hidden = false;
  updateNavButtons(stepIdentifier);
  updateProgress(stepIdentifier);
  window.scrollTo({ top: els.assessmentSection.offsetTop - 12, behavior: "smooth" });
  announce(`Now on ${typeof stepIdentifier === "number" ? "step " + stepIdentifier : stepIdentifier}`);
}

function updateProgress(stepIdentifier) {
  let percent, label;
  if (stepIdentifier === "preview") {
    percent = 100; label = "Review your answers";
  } else if (stepIdentifier === "result") {
    percent = 100; label = "Complete";
  } else {
    percent = Math.round((stepIdentifier / TOTAL_STEPS) * 100);
    label = `Step ${stepIdentifier} of ${TOTAL_STEPS}`;
  }
  els.stepLabel.textContent = label;
  els.progressPercentLabel.textContent = `${percent}%`;
  els.progressFill.style.width = `${percent}%`;
  els.progressBar.setAttribute("aria-valuenow", String(percent));
}

function updateNavButtons(stepIdentifier) {
  els.backBtn.hidden = stepIdentifier === 1 || stepIdentifier === "result";
  els.continueBtn.hidden = stepIdentifier === "preview" || stepIdentifier === "result";
  els.submitBtn.hidden = stepIdentifier !== "preview";
  if (stepIdentifier === "result") {
    document.getElementById("stepNav").style.display = "none";
  } else {
    document.getElementById("stepNav").style.display = "";
  }
}

function goToStep(nextStepIdentifier) {
  state.currentStep = nextStepIdentifier;
  state.view = nextStepIdentifier === "preview" ? "preview" : nextStepIdentifier === "result" ? "result" : "form";

  // Guarantee state.result exists before the preview is ever shown — this
  // covers both the normal "Continue" path (which already computes it) and
  // a restored draft that resumes directly onto the preview step, where
  // computeAssessmentResult() would otherwise never have run in this session.
  if (nextStepIdentifier === "preview") {
    computeAssessmentResult();
    renderAssessmentPreview();
  }

  showStep(nextStepIdentifier);
  saveDraft();
}

function handleContinue() {
  if (!validateCurrentStep()) return;
  readStepIntoState(state.currentStep);
  saveDraft();

  if (state.currentStep < TOTAL_STEPS) {
    goToStep(state.currentStep + 1);
  } else {
    // goToStep("preview") now computes the result and renders the preview itself
    goToStep("preview");
  }
}

function handleBack() {
  if (state.currentStep === "preview") {
    goToStep(TOTAL_STEPS);
    return;
  }
  if (typeof state.currentStep === "number" && state.currentStep > 1) {
    goToStep(state.currentStep - 1);
  }
}

function announce(message) {
  els.liveRegion.textContent = message;
}

/* ============================================================
   5. CONDITIONAL QUESTIONS
   ============================================================ */
function renderYesNoLists() {
  Object.entries(YESNO_SETS).forEach(([containerId, config]) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    config.questions.forEach(([key, questionText]) => {
      const item = document.createElement("div");
      item.className = "yesno-item";

      const q = document.createElement("span");
      q.className = "yesno-question";
      q.textContent = questionText;

      const toggle = document.createElement("div");
      toggle.className = "yesno-toggle";
      toggle.setAttribute("role", "group");
      toggle.setAttribute("aria-label", questionText);

      const yesBtn = document.createElement("button");
      yesBtn.type = "button";
      yesBtn.className = "yesno-btn";
      yesBtn.textContent = "Yes";
      yesBtn.setAttribute("aria-pressed", "false");

      const noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "yesno-btn";
      noBtn.textContent = "No";
      noBtn.setAttribute("aria-pressed", "false");

      yesBtn.addEventListener("click", () => setYesNo(config.bucket, key, true, yesBtn, noBtn));
      noBtn.addEventListener("click", () => setYesNo(config.bucket, key, false, yesBtn, noBtn));

      toggle.append(yesBtn, noBtn);
      item.append(q, toggle);
      container.appendChild(item);
    });
  });
}

function setYesNo(bucket, key, value, yesBtn, noBtn) {
  if (!state.answers[bucket]) state.answers[bucket] = {};
  state.answers[bucket][key] = value;
  yesBtn.setAttribute("aria-pressed", String(value === true));
  noBtn.setAttribute("aria-pressed", String(value === false));
  saveDraft();
  applyConditionalLogic();
}

function restoreYesNoUI() {
  Object.entries(YESNO_SETS).forEach(([containerId, config]) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const bucketAnswers = state.answers[config.bucket] || {};
    const items = container.querySelectorAll(".yesno-item");
    config.questions.forEach(([key], idx) => {
      const item = items[idx];
      if (!item) return;
      const [yesBtn, noBtn] = item.querySelectorAll(".yesno-btn");
      const val = bucketAnswers[key];
      if (val === true) { yesBtn.setAttribute("aria-pressed", "true"); noBtn.setAttribute("aria-pressed", "false"); }
      else if (val === false) { yesBtn.setAttribute("aria-pressed", "false"); noBtn.setAttribute("aria-pressed", "true"); }
    });
  });
}

// Business type "Other" free-text field
function setupBusinessTypeOther() {
  const select = document.getElementById("businessType");
  const wrap = document.getElementById("businessTypeOtherWrap");
  select.addEventListener("change", () => {
    wrap.hidden = select.value !== "Other";
  });
}

// Conditional product/service question blocks (Step 7) depend on sellsType
function applyConditionalLogic() {
  const sellsType = state.answers.sellsType ||
    (els.form.querySelector('input[name="sellsType"]:checked') || {}).value || "";

  const productBlock = document.getElementById("productQuestionsBlock");
  const serviceBlock = document.getElementById("serviceQuestionsBlock");

  const showProduct = sellsType === "Products" || sellsType === "Both";
  const showService = sellsType === "Services" || sellsType === "Both";

  if (productBlock) productBlock.hidden = !showProduct;
  if (serviceBlock) serviceBlock.hidden = !showService;
}

function setupSellsTypeListener() {
  els.form.querySelectorAll('input[name="sellsType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      state.answers.sellsType = radio.value;
      applyConditionalLogic();
    });
  });
}

/* ============================================================
   6. VALIDATION
   ============================================================ */
const NIGERIAN_PHONE_REGEX = /^(?:\+234|234|0)(70|71|80|81|90|91|20|24|27)\d{7,8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;

function clearFieldError(fieldName) {
  const errorEl = els.form.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorEl) { errorEl.textContent = ""; errorEl.classList.remove("visible"); }
  const container = document.getElementById(fieldName) ||
    els.form.querySelector(`[data-name="${fieldName}"]`);
  const fieldWrap = container?.closest(".field");
  fieldWrap?.classList.remove("has-error");
}

function setFieldError(fieldName, message) {
  const errorEl = els.form.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorEl) { errorEl.textContent = message; errorEl.classList.add("visible"); }
  const container = document.getElementById(fieldName) ||
    els.form.querySelector(`[data-name="${fieldName}"]`);
  const fieldWrap = container?.closest(".field");
  fieldWrap?.classList.add("has-error");
  return errorEl || container;
}

function clearAllErrorsInStep(stepEl) {
  stepEl.querySelectorAll(".error-msg").forEach((el) => { el.textContent = ""; el.classList.remove("visible"); });
  stepEl.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
}

function getCheckedValues(name) {
  return Array.from(els.form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
}

function getRadioValue(name) {
  const checked = els.form.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

// Returns true if step is valid; shows inline errors and scrolls to first error otherwise.
function validateCurrentStep() {
  const stepEl = getStepEl(state.currentStep);
  if (!stepEl) return true;
  clearAllErrorsInStep(stepEl);

  const errors = []; // { fieldName, message, el }

  const check = (fieldName, condition, message) => {
    if (!condition) {
      const el = setFieldError(fieldName, message);
      errors.push({ fieldName, message, el });
    }
  };

  if (state.currentStep === 1) {
    const fullName = document.getElementById("fullName").value.trim();
    const businessName = document.getElementById("businessName").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const socialLink = document.getElementById("socialLink").value.trim();
    const stateVal = document.getElementById("state").value.trim();
    const city = document.getElementById("city").value.trim();
    const preferredContact = getRadioValue("preferredContact");

    check("fullName", fullName.length > 0, "Please enter your full name.");
    check("businessName", businessName.length > 0, "Please enter your business name.");
    check("phone", phone.length > 0, "Please enter your phone number.");
    if (phone.length > 0) {
      const normalised = phone.replace(/[\s-]/g, "");
      check("phone", NIGERIAN_PHONE_REGEX.test(normalised), "Please enter a valid Nigerian phone number, e.g. 09064748799.");
    }
    if (email.length > 0) {
      check("email", EMAIL_REGEX.test(email), "Please enter a valid email address.");
    }
    if (socialLink.length > 0) {
      check("socialLink", URL_REGEX.test(socialLink), "Please enter a valid link (e.g. https://instagram.com/yourbusiness).");
    }
    check("state", stateVal.length > 0, "Please enter your state.");
    check("city", city.length > 0, "Please enter your city or town.");
    check("preferredContact", preferredContact.length > 0, "Please select a preferred contact method.");
  }

  if (state.currentStep === 2) {
    const businessType = document.getElementById("businessType").value;
    const businessTypeOther = document.getElementById("businessTypeOther").value.trim();
    const businessDescription = document.getElementById("businessDescription").value.trim();
    const targetCustomers = getCheckedValues("targetCustomers");
    const businessAge = document.getElementById("businessAge").value;
    const teamSize = document.getElementById("teamSize").value;
    const registrationStatus = getRadioValue("registrationStatus");

    check("businessType", businessType.length > 0, "Please select your business type.");
    if (businessType === "Other") {
      check("businessType", businessTypeOther.length > 0, "Please tell us your business type.");
    }
    check("businessDescription", businessDescription.length > 0, "Please briefly describe your business.");
    check("targetCustomers", targetCustomers.length > 0, "Please select at least one customer type.");
    check("businessAge", businessAge.length > 0, "Please select how long you've been operating.");
    check("teamSize", teamSize.length > 0, "Please select your team size.");
    check("registrationStatus", registrationStatus.length > 0, "Please select your registration status.");
  }

  if (state.currentStep === 4) {
    const platforms = getCheckedValues("platforms");
    check("platforms", platforms.length > 0, "Please select at least one option (or 'None').");
  }

  if (state.currentStep === 5) {
    const postFrequency = document.getElementById("postFrequency").value;
    check("postFrequency", postFrequency.length > 0, "Please select how often you post.");
  }

  if (state.currentStep === 6) {
    const contactChannels = getCheckedValues("contactChannels");
    const replySpeed = document.getElementById("replySpeed").value;
    check("contactChannels", contactChannels.length > 0, "Please select at least one contact channel.");
    check("replySpeed", replySpeed.length > 0, "Please select your typical reply speed.");
  }

  if (state.currentStep === 7) {
    const sellsType = getRadioValue("sellsType");
    const orderChannels = getCheckedValues("orderChannels");
    check("sellsType", sellsType.length > 0, "Please select what your business sells.");
    check("orderChannels", orderChannels.length > 0, "Please select at least one ordering channel.");
  }

  if (state.currentStep === 8) {
    const manualTasks = getCheckedValues("manualTasks");
    const dailyEnquiries = document.getElementById("dailyEnquiries").value;
    check("manualTasks", manualTasks.length > 0, "Please select at least one option.");
    check("dailyEnquiries", dailyEnquiries.length > 0, "Please select an approximate number of daily enquiries.");
  }

  if (state.currentStep === 9) {
    const mainGoal = document.getElementById("mainGoal").value;
    const improvementGoals = getCheckedValues("improvementGoals");
    const biggestChallenge = document.getElementById("biggestChallenge").value.trim();
    const successDefinition = document.getElementById("successDefinition").value.trim();
    const budgetRange = document.getElementById("budgetRange").value;
    const timeline = document.getElementById("timeline").value;
    const readinessLevel = getRadioValue("readinessLevel");
    const consentContact = document.getElementById("consentContact").checked;

    check("mainGoal", mainGoal.length > 0, "Please select your main goal.");
    check("improvementGoals", improvementGoals.length > 0, "Please select at least one area to improve.");
    check("biggestChallenge", biggestChallenge.length >= 10, "Please tell us a bit more (at least 10 characters).");
    check("successDefinition", successDefinition.length >= 5, "Please tell us what success looks like for you.");
    check("budgetRange", budgetRange.length > 0, "Please select your estimated budget.");
    check("timeline", timeline.length > 0, "Please select when you'd like to start.");
    check("readinessLevel", readinessLevel.length > 0, "Please select an option.");
    check("consentContact", consentContact, "Please agree to be contacted about your assessment to continue.");
  }

  if (errors.length > 0) {
    const firstErrorField = document.getElementById(errors[0].fieldName) ||
      els.form.querySelector(`[data-name="${errors[0].fieldName}"]`);
    firstErrorField?.scrollIntoView({ behavior: "smooth", block: "center" });
    announce(errors[0].message);
    return false;
  }

  return true;
}

// Live error-clearing as the user corrects fields
function setupLiveErrorClearing() {
  els.form.addEventListener("input", (e) => {
    const target = e.target;
    if (target.name) {
      clearFieldError(target.name);
      if (target.id) clearFieldError(target.id);
    }
  });
  els.form.addEventListener("change", (e) => {
    const target = e.target;
    if (target.name) {
      clearFieldError(target.name);
      if (target.id) clearFieldError(target.id);
    }
  });
}

/* Read the currently-visible step's raw DOM values into state.answers */
function readStepIntoState(step) {
  if (step === 1) {
    Object.assign(state.answers, {
      fullName: document.getElementById("fullName").value.trim(),
      businessName: document.getElementById("businessName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      preferredContact: getRadioValue("preferredContact"),
      state: document.getElementById("state").value.trim(),
      city: document.getElementById("city").value.trim(),
      address: document.getElementById("address").value.trim(),
      socialLink: document.getElementById("socialLink").value.trim(),
    });
  }
  if (step === 2) {
    Object.assign(state.answers, {
      businessType: document.getElementById("businessType").value,
      businessTypeOther: document.getElementById("businessTypeOther").value.trim(),
      businessDescription: document.getElementById("businessDescription").value.trim(),
      targetCustomers: getCheckedValues("targetCustomers"),
      businessAge: document.getElementById("businessAge").value,
      teamSize: document.getElementById("teamSize").value,
      registrationStatus: getRadioValue("registrationStatus"),
    });
  }
  if (step === 3) {
    state.answers.brandFeeling = document.getElementById("brandFeeling").value.trim();
  }
  if (step === 4) {
    state.answers.platforms = getCheckedValues("platforms");
    state.answers.onlineProblem = document.getElementById("onlineProblem").value.trim();
  }
  if (step === 5) {
    state.answers.postFrequency = document.getElementById("postFrequency").value;
    state.answers.contentTypes = getCheckedValues("contentTypes");
    state.answers.marketingChallenge = document.getElementById("marketingChallenge").value.trim();
  }
  if (step === 6) {
    state.answers.contactChannels = getCheckedValues("contactChannels");
    state.answers.replySpeed = document.getElementById("replySpeed").value;
    state.answers.commonQuestions = document.getElementById("commonQuestions").value.trim();
  }
  if (step === 7) {
    state.answers.sellsType = getRadioValue("sellsType");
    state.answers.orderChannels = getCheckedValues("orderChannels");
    state.answers.productCount = document.getElementById("productCount").value;
    state.answers.orderJourney = document.getElementById("orderJourney").value.trim();
  }
  if (step === 8) {
    state.answers.manualTasks = getCheckedValues("manualTasks");
    state.answers.dailyEnquiries = document.getElementById("dailyEnquiries").value;
    state.answers.timeStress = document.getElementById("timeStress").value.trim();
  }
  if (step === 9) {
    Object.assign(state.answers, {
      mainGoal: document.getElementById("mainGoal").value,
      improvementGoals: getCheckedValues("improvementGoals"),
      biggestChallenge: document.getElementById("biggestChallenge").value.trim(),
      previousAttempts: document.getElementById("previousAttempts").value.trim(),
      successDefinition: document.getElementById("successDefinition").value.trim(),
      budgetRange: document.getElementById("budgetRange").value,
      timeline: document.getElementById("timeline").value,
      readinessLevel: getRadioValue("readinessLevel"),
      finalNarration: document.getElementById("finalNarration").value.trim(),
      consentContact: document.getElementById("consentContact").checked,
      consentFollowUp: document.getElementById("consentFollowUp").checked,
    });
  }
}

/* ============================================================
   7. SERVICE KNOWLEDGE BASE
   ============================================================
   Each entry: { id, title, category, description, serviceName,
     importance (1-15), applicableBusinessTypes, triggers, reason,
     firstStep, laterStep }
   "applicableBusinessTypes" uses "all" for universally-relevant
   items, or specific business type strings from the Step 2 list.
   Triggers are matched against a computed set of "signal" strings
   (see identifyMissingItems) rather than raw form field names, so
   the knowledge base stays decoupled from the form's exact shape.
   ============================================================ */
const serviceKnowledgeBase = {
  // ---------------- BRANDING ----------------
  betterLogo: {
    id: "betterLogo", title: "Professional Logo Design", category: "branding",
    description: "A clean, memorable logo customers recognise across every platform.",
    serviceName: "Logo Design", importance: 13,
    applicableBusinessTypes: ["all"],
    triggers: ["no_logo", "unsatisfied_logo"],
    reason: "A logo is often the first thing a customer notices, and it currently needs attention.",
    firstStep: "Design a simple, professional logo that fits the brand.",
    laterStep: "Create logo variations for social media, packaging and print.",
  },
  brandColoursFonts: {
    id: "brandColoursFonts", title: "Brand Colours and Fonts", category: "branding",
    description: "A consistent colour palette and font pairing used across all materials.",
    serviceName: "Brand Colours and Fonts Kit", importance: 8,
    applicableBusinessTypes: ["all"],
    triggers: ["no_brand_colours", "inconsistent_materials"],
    reason: "Without fixed brand colours and fonts, materials look inconsistent across platforms.",
    firstStep: "Define 3-4 brand colours and 2 fonts to use everywhere.",
    laterStep: "Apply the palette across social media templates and packaging.",
  },
  completeBrandIdentity: {
    id: "completeBrandIdentity", title: "Complete Brand Identity", category: "branding",
    description: "A full identity system: logo, colours, fonts and usage guide, in one package.",
    serviceName: "Complete Brand Identity", importance: 14,
    applicableBusinessTypes: ["all"],
    triggers: ["no_logo", "no_brand_colours", "no_brand_guide"],
    reason: "Several branding basics are missing at once, so a complete identity avoids piecemeal fixes.",
    firstStep: "Build the logo, colours and fonts together as one connected system.",
    laterStep: "Document everything in a brand guide for consistent future use.",
  },
  socialMediaBranding: {
    id: "socialMediaBranding", title: "Social Media Branding", category: "branding",
    description: "Consistent profile pictures, covers and post templates across platforms.",
    serviceName: "Social Media Branding Kit", importance: 9,
    applicableBusinessTypes: ["all"],
    triggers: ["inconsistent_social_design"],
    reason: "Your social pages don't yet share one consistent visual style.",
    firstStep: "Create a matching profile picture, cover image and post template set.",
    laterStep: "Refresh templates seasonally to keep the page feeling current.",
  },
  professionalBusinessProfile: {
    id: "professionalBusinessProfile", title: "Professional Business Profile", category: "branding",
    description: "A one-page overview of the business for clients, partners or funders.",
    serviceName: "Business Profile Design", importance: 8,
    applicableBusinessTypes: ["consultant-coach", "professional-services", "construction", "ngo-foundation", "real-estate"],
    triggers: ["no_company_profile"],
    reason: "A company profile builds credibility with clients who ask 'what does your business do'.",
    firstStep: "Design a one-page company profile summarising services and experience.",
    laterStep: "Expand into a full company portfolio document with case studies.",
  },
  businessCard: {
    id: "businessCard", title: "Business Card", category: "branding",
    description: "A printable or digital business card for in-person networking.",
    serviceName: "Business Card Design", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_business_card"],
    reason: "A business card makes it easy to share contact details professionally in person.",
    firstStep: "Design a simple, branded business card.",
    laterStep: "Add a QR code linking to WhatsApp or your bio link page.",
  },
  digitalBusinessCard: {
    id: "digitalBusinessCard", title: "Digital Business Card", category: "branding",
    description: "A shareable digital card with tap-to-save contact details and links.",
    serviceName: "Digital Business Card", importance: 5,
    applicableBusinessTypes: ["consultant-coach", "professional-services", "real-estate"],
    triggers: ["no_business_card", "goal_look_professional"],
    reason: "A digital card is easy to share on WhatsApp and looks modern to new contacts.",
    firstStep: "Create a digital business card with your contact details and links.",
    laterStep: "Track how often it's viewed and shared.",
  },
  letterhead: {
    id: "letterhead", title: "Letterhead", category: "branding",
    description: "A branded letterhead template for official documents.",
    serviceName: "Letterhead Design", importance: 4,
    applicableBusinessTypes: ["professional-services", "construction", "ngo-foundation", "school", "real-estate"],
    triggers: ["no_letterhead"],
    reason: "Official letters currently have no consistent branded format.",
    firstStep: "Design a branded letterhead template.",
    laterStep: "Create matching templates for contracts and proposals.",
  },
  invoiceDesign: {
    id: "invoiceDesign", title: "Invoice Design", category: "branding",
    description: "A professional, branded invoice template for every sale.",
    serviceName: "Invoice Design", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_invoice_design"],
    reason: "Branded invoices look more trustworthy and professional to paying customers.",
    firstStep: "Design a simple branded invoice template.",
    laterStep: "Automate invoice generation and sending.",
  },
  receiptDesign: {
    id: "receiptDesign", title: "Receipt Design", category: "branding",
    description: "A branded receipt template customers get after every payment.",
    serviceName: "Receipt Design", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_receipt_design"],
    reason: "A branded receipt reassures customers their payment was received correctly.",
    firstStep: "Design a simple branded receipt template.",
    laterStep: "Automate receipts to send instantly after payment.",
  },
  emailSignature: {
    id: "emailSignature", title: "Email Signature", category: "branding",
    description: "A professional signature added to every business email.",
    serviceName: "Email Signature Design", importance: 3,
    applicableBusinessTypes: ["all"],
    triggers: ["has_business_email", "no_brand_guide"],
    reason: "A professional signature reinforces your brand every time you send an email.",
    firstStep: "Design a clean email signature with your logo and contact details.",
    laterStep: "Add social links and a call-to-action to the signature.",
  },
  companyProfile: {
    id: "companyProfile", title: "Company Profile", category: "branding",
    description: "A detailed multi-page document describing the business, services and track record.",
    serviceName: "Company Profile Document", importance: 8,
    applicableBusinessTypes: ["construction", "engineering", "architecture", "professional-services", "ngo-foundation"],
    triggers: ["no_company_profile", "goal_look_professional"],
    reason: "Larger clients and partners often request a formal company profile before working with you.",
    firstStep: "Write and design a professional company profile document.",
    laterStep: "Update it regularly with new projects and testimonials.",
  },
  brandGuide: {
    id: "brandGuide", title: "Brand Guide", category: "branding",
    description: "A reference document showing exactly how to use your logo, colours and fonts.",
    serviceName: "Brand Guide", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_brand_guide"],
    reason: "Without a guide, it's easy for branding to drift and look inconsistent over time.",
    firstStep: "Document your logo usage rules, colours and fonts in one guide.",
    laterStep: "Share the guide with anyone who creates content for the business.",
  },
  productLabels: {
    id: "productLabels", title: "Product Labels and Stickers", category: "branding",
    description: "Branded labels and stickers for products and packages.",
    serviceName: "Product Label Design", importance: 6,
    applicableBusinessTypes: ["fashion-clothing", "beauty-skincare", "bakery-catering", "online-store", "retail-shop", "food-restaurant", "agriculture"],
    triggers: ["no_labels"],
    reason: "Labels help products look professional and reinforce your brand at the point of sale.",
    firstStep: "Design a branded label or sticker for your products.",
    laterStep: "Add QR codes linking to your catalogue or reviews.",
  },
  packagingDesign: {
    id: "packagingDesign", title: "Packaging Design", category: "branding",
    description: "Branded packaging that makes products feel premium and shareable.",
    serviceName: "Packaging Design", importance: 7,
    applicableBusinessTypes: ["fashion-clothing", "beauty-skincare", "bakery-catering", "online-store", "retail-shop", "food-restaurant"],
    triggers: ["no_packaging"],
    reason: "Good packaging increases perceived value and encourages customers to share on social media.",
    firstStep: "Design simple branded packaging for your best-selling items.",
    laterStep: "Extend the packaging design across your full product range.",
  },

  // ---------------- MARKETING AND CONTENT ----------------
  promoGraphics: {
    id: "promoGraphics", title: "Promotional Graphics", category: "marketing",
    description: "Professionally designed graphics for products, services and offers.",
    serviceName: "Promotional Graphics Package", importance: 10,
    applicableBusinessTypes: ["all"],
    triggers: ["no_promo_graphics", "low_posting"],
    reason: "Professional graphics make posts stand out and look more trustworthy than plain photos.",
    firstStep: "Design a set of promotional graphics for your top products or services.",
    laterStep: "Build a recurring set of monthly promotional designs.",
  },
  saleOfferDesigns: {
    id: "saleOfferDesigns", title: "Sales and Offer Designs", category: "marketing",
    description: "Eye-catching graphics for discounts, sales and limited offers.",
    serviceName: "Sales and Offer Design Pack", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_sale_designs"],
    reason: "Clear offer designs make discounts more noticeable and drive faster action.",
    firstStep: "Create a reusable template for sales and discount announcements.",
    laterStep: "Plan seasonal offer campaigns in advance.",
  },
  socialMediaPosts: {
    id: "socialMediaPosts", title: "Social Media Post Design", category: "marketing",
    description: "A recurring set of on-brand posts for your social pages.",
    serviceName: "Social Media Content Package", importance: 9,
    applicableBusinessTypes: ["all"],
    triggers: ["low_posting", "no_content_calendar"],
    reason: "Posting is currently inconsistent, which makes it harder for customers to notice you.",
    firstStep: "Design a set of ready-to-post templates for the month.",
    laterStep: "Move to a full monthly content plan with a fixed posting schedule.",
  },
  carouselDesigns: {
    id: "carouselDesigns", title: "Carousel Post Designs", category: "marketing",
    description: "Multi-slide carousel posts that explain a service or showcase products.",
    serviceName: "Carousel Design Package", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_educational_content"],
    reason: "Carousels are a simple way to explain your services in more depth than a single image.",
    firstStep: "Design a carousel post introducing your top service or product.",
    laterStep: "Create a recurring 'tips' or 'how it works' carousel series.",
  },
  shortPromoVideos: {
    id: "shortPromoVideos", title: "Short Promotional Videos", category: "marketing",
    description: "Short-form videos for Reels, TikTok and Status.",
    serviceName: "Short Promo Video Package", importance: 8,
    applicableBusinessTypes: ["all"],
    triggers: ["no_promo_videos"],
    reason: "Short videos currently get more reach than static posts on most platforms.",
    firstStep: "Produce a short promo video showcasing your product or service.",
    laterStep: "Build a recurring monthly video content plan.",
  },
  aiPromoVideos: {
    id: "aiPromoVideos", title: "AI Promotional Videos", category: "marketing",
    description: "AI-generated promotional videos produced quickly and affordably.",
    serviceName: "AI Promotional Video", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_promo_videos", "budget_limited"],
    reason: "AI video production is a faster, lower-cost way to start creating video content.",
    firstStep: "Produce one AI-generated promotional video to test the format.",
    laterStep: "Scale up video output once the format proves effective.",
  },
  betterProductPhotos: {
    id: "betterProductPhotos", title: "Better Product Photos", category: "marketing",
    description: "Clear, professional photos that show products or work in the best light.",
    serviceName: "Product Photography Guidance", importance: 9,
    applicableBusinessTypes: ["fashion-clothing", "beauty-skincare", "bakery-catering", "online-store", "retail-shop", "food-restaurant", "photography-videography"],
    triggers: ["unclear_photos"],
    reason: "Unclear product photos make it harder for customers to trust what they're buying.",
    firstStep: "Reshoot key product photos with clear lighting and consistent style.",
    laterStep: "Build a simple in-house photo setup for ongoing content.",
  },
  betterBusinessBio: {
    id: "betterBusinessBio", title: "Better Business Bio", category: "marketing",
    description: "A clear bio that explains what you offer and what to do next.",
    serviceName: "Business Bio Copywriting", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_bio", "weak_bio", "no_bio_cta"],
    reason: "Your current bio doesn't clearly explain your offer or tell visitors what to do next.",
    firstStep: "Rewrite your bio to be clear, specific and end with a call-to-action.",
    laterStep: "Keep the bio updated as your offers change.",
  },
  contentCalendar: {
    id: "contentCalendar", title: "Content Calendar", category: "marketing",
    description: "A simple posting plan so content goes out consistently.",
    serviceName: "Content Calendar Setup", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_content_calendar", "low_posting"],
    reason: "Posting without a plan makes it easy to go quiet for long stretches.",
    firstStep: "Build a simple monthly content calendar with post ideas.",
    laterStep: "Review performance monthly and adjust the plan.",
  },
  customerTestimonials: {
    id: "customerTestimonials", title: "Customer Testimonials Content", category: "marketing",
    description: "Designed posts that showcase real customer feedback.",
    serviceName: "Testimonial Content Design", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_testimonials_used"],
    reason: "Showing real feedback builds trust faster than describing your own quality.",
    firstStep: "Collect a few recent reviews and turn them into shareable posts.",
    laterStep: "Make testimonial posting a regular part of your content plan.",
  },
  beforeAfterContent: {
    id: "beforeAfterContent", title: "Before-and-After Content", category: "marketing",
    description: "Visual proof of results that builds trust quickly.",
    serviceName: "Before-and-After Content Design", importance: 6,
    applicableBusinessTypes: ["hair-salon", "barbering", "beauty-skincare", "cleaning-services", "fitness", "construction"],
    triggers: ["no_before_after"],
    reason: "Before-and-after content is one of the strongest trust-builders for your type of business.",
    firstStep: "Document and design your next few before-and-after results.",
    laterStep: "Build a gallery of before-and-after work on your website or bio link.",
  },
  seasonalPromotions: {
    id: "seasonalPromotions", title: "Seasonal Promotions", category: "marketing",
    description: "Timely promotional designs tied to holidays and seasons.",
    serviceName: "Seasonal Promotion Design", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_seasonal_promos"],
    reason: "Seasonal promotions are a simple way to create urgency and boost sales at key times.",
    firstStep: "Plan and design your next seasonal promotion.",
    laterStep: "Build a yearly calendar of seasonal promotion dates.",
  },
  clearCallToAction: {
    id: "clearCallToAction", title: "Clear Call-to-Action Copywriting", category: "marketing",
    description: "Post captions that clearly tell customers what to do next.",
    serviceName: "Call-to-Action Copywriting", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_posts_cta"],
    reason: "Posts without a clear next step leave interested customers unsure how to proceed.",
    firstStep: "Add a clear call-to-action to your next batch of posts.",
    laterStep: "Test different calls-to-action to see which get the most replies.",
  },
  priceListDesign: {
    id: "priceListDesign", title: "Price List Design", category: "marketing",
    description: "A clear, branded price list customers can view instantly.",
    serviceName: "Price List Design", importance: 8,
    applicableBusinessTypes: ["all"],
    triggers: ["no_price_list", "no_prices_displayed"],
    reason: "Customers often hesitate to ask for prices; a visible price list removes that friction.",
    firstStep: "Design a clean, branded price list.",
    laterStep: "Update it regularly and share it in your WhatsApp catalogue.",
  },
  productCatalogue: {
    id: "productCatalogue", title: "Product Catalogue", category: "marketing",
    description: "A single document or page showing all products with photos and prices.",
    serviceName: "Product Catalogue Design", importance: 8,
    applicableBusinessTypes: ["fashion-clothing", "beauty-skincare", "online-store", "retail-shop", "bakery-catering", "agriculture"],
    triggers: ["no_catalogue_visible", "sells_products"],
    reason: "Customers can't currently view everything you sell in one place before contacting you.",
    firstStep: "Create a simple catalogue showing your products, photos and prices.",
    laterStep: "Move the catalogue online so it updates automatically.",
  },
  serviceCatalogue: {
    id: "serviceCatalogue", title: "Service Catalogue", category: "marketing",
    description: "A clear list of services offered, with descriptions and pricing.",
    serviceName: "Service Catalogue Design", importance: 8,
    applicableBusinessTypes: ["hair-salon", "barbering", "beauty-skincare", "cleaning-services", "consultant-coach", "professional-services", "fitness"],
    triggers: ["no_catalogue_visible", "sells_services"],
    reason: "A clear service list helps customers understand your full offering before they ask.",
    firstStep: "Design a simple service catalogue with pricing.",
    laterStep: "Add the catalogue to WhatsApp Business and your bio link.",
  },

  // ---------------- ONLINE PRESENCE ----------------
  bioLinkPage: {
    id: "bioLinkPage", title: "Bio Link Page", category: "online-presence",
    description: "A single link that leads to all your important pages and contact options.",
    serviceName: "Bio Link Page Setup", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_bio_link"],
    reason: "A bio link page gives customers one place to find everything about your business.",
    firstStep: "Set up a simple bio link page with your key links and contact options.",
    laterStep: "Add a booking or ordering link once available.",
  },
  simpleWebsite: {
    id: "simpleWebsite", title: "Simple Business Website", category: "online-presence",
    description: "A one-to-few-page website presenting the business professionally.",
    serviceName: "Simple Website", importance: 12,
    applicableBusinessTypes: ["all"],
    triggers: ["no_website", "goal_build_website"],
    reason: "Many customers expect to find a website before trusting a business fully.",
    firstStep: "Build a simple website covering your services, contact details and location.",
    laterStep: "Add a blog, gallery or booking form as the business grows.",
  },
  businessWebsite: {
    id: "businessWebsite", title: "Full Business Website", category: "online-presence",
    description: "A complete multi-page website with services, gallery and contact form.",
    serviceName: "Business Website", importance: 12,
    applicableBusinessTypes: ["professional-services", "construction", "engineering", "architecture", "school", "hotel-shortlet", "real-estate", "health-pharmacy"],
    triggers: ["no_website", "website_incomplete"],
    reason: "A full website helps larger or service-based businesses present all their offerings clearly.",
    firstStep: "Build a multi-page website covering all services and locations.",
    laterStep: "Add SEO and analytics to track visitor growth.",
  },
  portfolioWebsite: {
    id: "portfolioWebsite", title: "Portfolio Website", category: "online-presence",
    description: "A visual website showcasing past work and results.",
    serviceName: "Portfolio Website", importance: 10,
    applicableBusinessTypes: ["photography-videography", "event-planning-decoration", "digital-creator", "architecture"],
    triggers: ["no_website", "goal_look_professional"],
    reason: "A portfolio is often the deciding factor for customers comparing creative businesses.",
    firstStep: "Build a portfolio website showcasing your best work.",
    laterStep: "Add client testimonials and a simple enquiry form.",
  },
  landingPage: {
    id: "landingPage", title: "Landing Page", category: "online-presence",
    description: "A focused single page built to promote one offer or product launch.",
    serviceName: "Landing Page Design", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["goal_sell_online", "no_website"],
    reason: "A landing page is a fast way to promote a specific offer without building a full site.",
    firstStep: "Build a landing page for your current top offer.",
    laterStep: "Reuse the format for future promotions and launches.",
  },
  professionalDomain: {
    id: "professionalDomain", title: "Professional Domain Name", category: "online-presence",
    description: "A custom domain name (e.g. yourbusiness.com) instead of a generic link.",
    serviceName: "Domain Name Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_domain"],
    reason: "A custom domain looks more professional and is easier for customers to remember.",
    firstStep: "Register and connect a domain name matching your business.",
    laterStep: "Set up a matching professional email address on the same domain.",
  },
  professionalBusinessEmail: {
    id: "professionalBusinessEmail", title: "Professional Business Email", category: "online-presence",
    description: "An email address on your own domain instead of a free provider.",
    serviceName: "Business Email Setup", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_business_email"],
    reason: "A branded email address is viewed as more trustworthy for official communication.",
    firstStep: "Set up a professional email address using your business domain.",
    laterStep: "Add the email to your invoices, signature and website.",
  },
  googleBusinessProfile: {
    id: "googleBusinessProfile", title: "Google Business Profile", category: "online-presence",
    description: "A Google Business Profile helps customers find the business through Google Search and Google Maps.",
    serviceName: "Google Business Profile Setup", importance: 12,
    applicableBusinessTypes: ["all", "local-business"],
    triggers: ["not_listed_google", "goal_more_customers", "goal_google_visibility"],
    reason: "The business is not fully visible to customers searching for its services online.",
    firstStep: "Set up and optimise the Google Business Profile with the correct location, contact details, services and pictures.",
    laterStep: "Collect customer reviews and post updates regularly.",
  },
  googleMapsLocation: {
    id: "googleMapsLocation", title: "Google Maps Location Setup", category: "online-presence",
    description: "Correcting or adding your exact location on Google Maps.",
    serviceName: "Google Maps Location Fix", importance: 8,
    applicableBusinessTypes: ["all", "local-business"],
    triggers: ["wrong_google_location"],
    reason: "Customers searching nearby currently cannot find your correct location.",
    firstStep: "Correct your business location and details on Google Maps.",
    laterStep: "Encourage customers to leave location-tagged reviews.",
  },
  seo: {
    id: "seo", title: "Search Engine Optimisation", category: "online-presence",
    description: "Improving your website so it appears in relevant Google searches.",
    serviceName: "Search Engine Optimisation (SEO)", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_google_enquiries", "has_website"],
    reason: "Your website exists but currently brings in few enquiries from search.",
    firstStep: "Optimise your website pages for the searches your customers use.",
    laterStep: "Track rankings and continue improving content over time.",
  },
  websiteAnalytics: {
    id: "websiteAnalytics", title: "Website Analytics", category: "online-presence",
    description: "Simple tracking to see how many people visit and what they do.",
    serviceName: "Website Analytics Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_visitor_data", "has_website"],
    reason: "Without analytics, it's hard to know if your marketing efforts are working.",
    firstStep: "Set up basic analytics to track visits and enquiries.",
    laterStep: "Review monthly reports to guide future marketing decisions.",
  },
  contactForm: {
    id: "contactForm", title: "Website Contact Form", category: "online-presence",
    description: "A simple form that lets customers reach you directly from your website.",
    serviceName: "Contact Form Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["has_website", "hard_to_find_contact"],
    reason: "Customers on your website currently have no direct way to reach you.",
    firstStep: "Add a simple contact form to your website.",
    laterStep: "Connect the form to automatic email or WhatsApp notifications.",
  },
  bookingWebsite: {
    id: "bookingWebsite", title: "Booking Website", category: "online-presence",
    description: "A website with built-in appointment booking.",
    serviceName: "Booking Website", importance: 10,
    applicableBusinessTypes: ["hair-salon", "barbering", "beauty-skincare", "fitness", "health-pharmacy", "consultant-coach", "hotel-shortlet", "photography-videography"],
    triggers: ["needs_booking", "no_online_booking"],
    reason: "Customers currently cannot book directly online and must message you manually.",
    firstStep: "Build a website with an integrated booking calendar.",
    laterStep: "Add automatic reminders and rescheduling options.",
  },

  // ---------------- ONLINE STORE ----------------
  productCatalogueWebsite: {
    id: "productCatalogueWebsite", title: "Product Catalogue Website", category: "online-store",
    description: "A website showcasing products for browsing, without full checkout.",
    serviceName: "Product Catalogue Website", importance: 8,
    applicableBusinessTypes: ["fashion-clothing", "retail-shop", "online-store", "agriculture"],
    triggers: ["no_catalogue_visible", "sells_products"],
    reason: "Customers cannot yet browse your full range of products online in one place.",
    firstStep: "Build a simple website showcasing all products with photos and prices.",
    laterStep: "Add online ordering once the catalogue is established.",
  },
  onePageOnlineStore: {
    id: "onePageOnlineStore", title: "One-Page Online Store", category: "online-store",
    description: "A lightweight online store for a small number of products.",
    serviceName: "One-Page Online Store", importance: 9,
    applicableBusinessTypes: ["online-store", "fashion-clothing", "beauty-skincare", "retail-shop"],
    triggers: ["no_order_online", "small_product_count"],
    reason: "Customers currently must message you to order rather than checking out directly.",
    firstStep: "Build a simple one-page store for your best-selling items.",
    laterStep: "Expand into a full multi-page store as your catalogue grows.",
  },
  smallOnlineStore: {
    id: "smallOnlineStore", title: "Small Online Store", category: "online-store",
    description: "A full online store suited to a medium-sized product catalogue.",
    serviceName: "Small Online Store Build", importance: 10,
    applicableBusinessTypes: ["online-store", "fashion-clothing", "retail-shop"],
    triggers: ["no_order_online", "medium_product_count"],
    reason: "Your product range is large enough to benefit from a proper online store.",
    firstStep: "Build a small online store with product pages and checkout.",
    laterStep: "Add inventory tracking and customer accounts.",
  },
  standardEcommerce: {
    id: "standardEcommerce", title: "Standard E-commerce Website", category: "online-store",
    description: "A full e-commerce website with payments, inventory and order tracking.",
    serviceName: "Standard E-commerce Website", importance: 12,
    applicableBusinessTypes: ["online-store", "fashion-clothing", "retail-shop", "agriculture"],
    triggers: ["no_order_online", "large_product_count"],
    reason: "A catalogue this size needs a proper e-commerce system to manage orders efficiently.",
    firstStep: "Build a standard e-commerce website with checkout and stock tracking.",
    laterStep: "Add customer accounts, reviews and coupon codes.",
  },
  premiumEcommerce: {
    id: "premiumEcommerce", title: "Premium E-commerce Website", category: "online-store",
    description: "An advanced online store with dashboards, automation and analytics.",
    serviceName: "Premium E-commerce Website", importance: 13,
    applicableBusinessTypes: ["online-store", "fashion-clothing", "retail-shop"],
    triggers: ["no_order_online", "large_product_count", "wants_dashboard"],
    reason: "At this scale, an advanced store with full automation will save significant time.",
    firstStep: "Build a premium store with dashboards and automated order handling.",
    laterStep: "Layer in marketing automation and loyalty features.",
  },
  paymentGateway: {
    id: "paymentGateway", title: "Online Payment Gateway", category: "online-store",
    description: "Lets customers pay instantly online by card or transfer.",
    serviceName: "Payment Gateway Integration", importance: 10,
    applicableBusinessTypes: ["all"],
    triggers: ["no_pay_online"],
    reason: "Customers currently cannot pay online and must arrange payment manually.",
    firstStep: "Integrate a payment gateway for card and transfer payments.",
    laterStep: "Add automatic payment confirmation messages.",
  },
  deliveryTracking: {
    id: "deliveryTracking", title: "Delivery Tracking", category: "online-store",
    description: "Lets customers see the status of their delivery.",
    serviceName: "Delivery Tracking System", importance: 6,
    applicableBusinessTypes: ["fashion-clothing", "online-store", "retail-shop", "food-restaurant", "bakery-catering"],
    triggers: ["no_delivery_updates", "needs_delivery_tracking"],
    reason: "Customers currently have no way to check on their delivery status.",
    firstStep: "Set up simple delivery status updates for customers.",
    laterStep: "Add automatic SMS or WhatsApp delivery notifications.",
  },
  inventoryManagement: {
    id: "inventoryManagement", title: "Inventory Management", category: "online-store",
    description: "Tracks stock levels automatically as items sell.",
    serviceName: "Inventory Management System", importance: 8,
    applicableBusinessTypes: ["fashion-clothing", "online-store", "retail-shop", "bakery-catering", "agriculture"],
    triggers: ["no_stock_tracking", "needs_inventory"],
    reason: "Stock is currently tracked manually, which risks overselling or running out unnoticed.",
    firstStep: "Set up simple inventory tracking linked to your sales.",
    laterStep: "Add low-stock alerts and supplier reordering reminders.",
  },
  customerDashboard: {
    id: "customerDashboard", title: "Customer Dashboard", category: "online-store",
    description: "Lets returning customers view past orders and reorder easily.",
    serviceName: "Customer Account Dashboard", importance: 5,
    applicableBusinessTypes: ["online-store", "retail-shop"],
    triggers: ["no_customer_dashboard"],
    reason: "Repeat customers currently have no way to view past orders or reorder quickly.",
    firstStep: "Add basic customer accounts to the store.",
    laterStep: "Show order history and personalised recommendations.",
  },
  wishlistReviews: {
    id: "wishlistReviews", title: "Wishlist and Reviews", category: "online-store",
    description: "Lets customers save favourites and leave product reviews.",
    serviceName: "Wishlist and Review Features", importance: 4,
    applicableBusinessTypes: ["online-store", "fashion-clothing", "retail-shop"],
    triggers: ["no_reviews_collected"],
    reason: "Reviews and wishlists help build trust and encourage repeat visits.",
    firstStep: "Add a simple review feature to product pages.",
    laterStep: "Add wishlist and 'save for later' functionality.",
  },
  couponSystem: {
    id: "couponSystem", title: "Coupon and Discount Codes", category: "online-store",
    description: "Lets you run promotions with trackable discount codes.",
    serviceName: "Coupon Code System", importance: 3,
    applicableBusinessTypes: ["online-store", "fashion-clothing", "retail-shop"],
    triggers: ["no_coupons_used"],
    reason: "Discount codes make it easier to track which promotions actually drive sales.",
    firstStep: "Set up a basic coupon code system for your store.",
    laterStep: "Use codes for referral programs and loyalty rewards.",
  },
  whatsappOrderIntegration: {
    id: "whatsappOrderIntegration", title: "WhatsApp Order Integration", category: "online-store",
    description: "Lets customers complete an order and have it sent straight to your WhatsApp.",
    serviceName: "WhatsApp Order Integration", importance: 7,
    applicableBusinessTypes: ["all"],
    triggers: ["orders_via_whatsapp", "no_order_online"],
    reason: "Most orders already happen over WhatsApp, so structuring that flow reduces back-and-forth.",
    firstStep: "Set up a structured WhatsApp ordering flow with clear steps.",
    laterStep: "Connect it to automatic order confirmations.",
  },
  emailNotifications: {
    id: "emailNotifications", title: "Email Notifications", category: "online-store",
    description: "Automatic emails for orders, confirmations and updates.",
    serviceName: "Email Notification Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_order_confirmation", "has_business_email"],
    reason: "Customers currently don't receive any automatic confirmation after ordering.",
    firstStep: "Set up automatic order confirmation emails.",
    laterStep: "Add shipping and delivery update emails.",
  },
  smsNotifications: {
    id: "smsNotifications", title: "SMS Notifications", category: "online-store",
    description: "Automatic SMS updates for orders and appointments.",
    serviceName: "SMS Notification Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_booking_confirmation", "no_order_confirmation"],
    reason: "SMS reaches customers reliably even without internet access.",
    firstStep: "Set up SMS confirmations for orders or bookings.",
    laterStep: "Add SMS reminders ahead of appointments or deliveries.",
  },

  // ---------------- CUSTOMER SUPPORT AND AUTOMATION ----------------
  whatsappBusinessSetup: {
    id: "whatsappBusinessSetup", title: "WhatsApp Business Setup", category: "automation",
    description: "Proper setup of WhatsApp Business with catalogue and quick replies.",
    serviceName: "WhatsApp Business Setup", importance: 8,
    applicableBusinessTypes: ["all"],
    triggers: ["no_whatsapp_business"],
    reason: "WhatsApp Business unlocks tools like catalogues and quick replies that a personal account can't.",
    firstStep: "Set up a WhatsApp Business account with your business details.",
    laterStep: "Add a full product or service catalogue.",
  },
  whatsappCatalogue: {
    id: "whatsappCatalogue", title: "WhatsApp Catalogue", category: "automation",
    description: "A visual catalogue inside WhatsApp Business customers can browse.",
    serviceName: "WhatsApp Catalogue Setup", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["incomplete_catalogue"],
    reason: "Your WhatsApp catalogue is incomplete, so customers can't browse everything you offer.",
    firstStep: "Complete your WhatsApp catalogue with all products or services.",
    laterStep: "Keep the catalogue updated as prices or offerings change.",
  },
  quickReplies: {
    id: "quickReplies", title: "WhatsApp Quick Replies", category: "automation",
    description: "Saved replies for common questions, sent in one tap.",
    serviceName: "Quick Replies Setup", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["repeated_questions", "no_quick_replies"],
    reason: "The same questions come up repeatedly, and quick replies can save time answering them.",
    firstStep: "Set up quick replies for your most common questions.",
    laterStep: "Review and update replies as new questions come up.",
  },
  automaticWelcomeMessage: {
    id: "automaticWelcomeMessage", title: "Automatic Welcome Message", category: "automation",
    description: "Greets new customers instantly, even outside working hours.",
    serviceName: "Welcome Message Setup", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_welcome_message"],
    reason: "New enquiries currently receive no instant response while you're unavailable.",
    firstStep: "Set up an automatic welcome message for new chats.",
    laterStep: "Personalise the message based on time of day.",
  },
  awayMessage: {
    id: "awayMessage", title: "Away Message", category: "automation",
    description: "Lets customers know when you'll reply if you're currently unavailable.",
    serviceName: "Away Message Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_away_message"],
    reason: "Customers messaging outside your hours currently get no response at all.",
    firstStep: "Set up an away message with expected reply time.",
    laterStep: "Display your business hours clearly alongside it.",
  },
  aiCustomerSupport: {
    id: "aiCustomerSupport", title: "AI Customer Support", category: "automation",
    description: "An AI assistant that answers common questions instantly, any time of day.",
    serviceName: "AI Customer Support Setup", importance: 10,
    applicableBusinessTypes: ["all"],
    triggers: ["wants_chatbot", "high_enquiry_volume"],
    reason: "The volume of repeat enquiries makes an AI assistant worth the investment.",
    firstStep: "Set up an AI assistant to answer your most frequent questions.",
    laterStep: "Expand it to handle bookings or orders directly.",
  },
  websiteChatbot: {
    id: "websiteChatbot", title: "Website Chatbot", category: "automation",
    description: "A chat widget on your website that answers visitor questions instantly.",
    serviceName: "Website Chatbot Setup", importance: 7,
    applicableBusinessTypes: ["all"],
    triggers: ["wants_chatbot", "has_website"],
    reason: "Website visitors currently have no way to get an instant answer without leaving the page.",
    firstStep: "Add a simple chatbot widget to answer common questions.",
    laterStep: "Train it to guide visitors toward booking or ordering.",
  },
  whatsappAiAssistant: {
    id: "whatsappAiAssistant", title: "WhatsApp AI Assistant", category: "automation",
    description: "An AI assistant that replies to WhatsApp enquiries automatically.",
    serviceName: "WhatsApp AI Assistant Setup", importance: 9,
    applicableBusinessTypes: ["all"],
    triggers: ["wants_chatbot", "high_enquiry_volume", "slow_replies"],
    reason: "Slow replies are likely costing you customers, and an AI assistant responds instantly.",
    firstStep: "Set up an AI assistant to handle first responses on WhatsApp.",
    laterStep: "Hand off complex questions to you automatically.",
  },
  leadCaptureAutomation: {
    id: "leadCaptureAutomation", title: "Lead Capture Automation", category: "automation",
    description: "Automatically collects and organises new enquiries as they come in.",
    serviceName: "Lead Capture Automation", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_enquiry_records"],
    reason: "Enquiries aren't currently recorded anywhere, so some may be forgotten.",
    firstStep: "Set up automatic recording of every new enquiry.",
    laterStep: "Add automatic tagging by enquiry type or urgency.",
  },
  customerFollowUpAutomation: {
    id: "customerFollowUpAutomation", title: "Customer Follow-up Automation", category: "automation",
    description: "Automatically checks in with customers after an enquiry or sale.",
    serviceName: "Customer Follow-up Automation", importance: 9,
    applicableBusinessTypes: ["all"],
    triggers: ["no_follow_up", "customers_stop_replying", "wants_follow_up"],
    reason: "Customers are dropping off before completing an order, and follow-ups can recover many of them.",
    firstStep: "Set up automatic follow-up messages after an enquiry.",
    laterStep: "Extend follow-ups to include post-sale check-ins.",
  },
  appointmentBooking: {
    id: "appointmentBooking", title: "Appointment Booking System", category: "automation",
    description: "Lets customers book a time slot without back-and-forth messaging.",
    serviceName: "Appointment Booking System", importance: 10,
    applicableBusinessTypes: ["hair-salon", "barbering", "beauty-skincare", "fitness", "health-pharmacy", "consultant-coach", "photography-videography", "hotel-shortlet"],
    triggers: ["needs_booking", "no_online_booking"],
    reason: "Customers currently must message back and forth to arrange a time, which slows things down.",
    firstStep: "Set up an online booking calendar for appointments.",
    laterStep: "Add time-slot selection and automatic confirmations.",
  },
  appointmentReminders: {
    id: "appointmentReminders", title: "Appointment Reminders", category: "automation",
    description: "Automatic reminders sent before a scheduled appointment.",
    serviceName: "Appointment Reminder Automation", importance: 6,
    applicableBusinessTypes: ["hair-salon", "barbering", "beauty-skincare", "fitness", "health-pharmacy", "consultant-coach"],
    triggers: ["no_appointment_reminders", "needs_auto_reminders"],
    reason: "Missed appointments are more likely without an automatic reminder beforehand.",
    firstStep: "Set up automatic reminders sent a day before appointments.",
    laterStep: "Add a second reminder closer to the appointment time.",
  },
  orderConfirmationAutomation: {
    id: "orderConfirmationAutomation", title: "Order Confirmation Automation", category: "automation",
    description: "Instantly confirms new orders without manual typing.",
    serviceName: "Order Confirmation Automation", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_order_confirmation", "manual_order_confirm"],
    reason: "Order confirmations are currently handled manually, which takes time and can be missed.",
    firstStep: "Set up automatic order confirmation messages.",
    laterStep: "Add order status tracking after confirmation.",
  },
  paymentConfirmationAutomation: {
    id: "paymentConfirmationAutomation", title: "Payment Confirmation Automation", category: "automation",
    description: "Automatically confirms when a payment has been received.",
    serviceName: "Payment Confirmation Automation", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_payment_confirmation"],
    reason: "Customers currently wait for manual confirmation that their payment went through.",
    firstStep: "Set up automatic payment confirmation messages.",
    laterStep: "Link confirmations directly to your payment gateway.",
  },
  invoiceAutomation: {
    id: "invoiceAutomation", title: "Invoice Automation", category: "automation",
    description: "Automatically generates and sends invoices for every sale.",
    serviceName: "Invoice Automation", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["manual_invoices"],
    reason: "Invoices are currently created manually for every sale, which takes up valuable time.",
    firstStep: "Automate invoice generation for new sales.",
    laterStep: "Add automatic reminders for unpaid invoices.",
  },
  emailAutomation: {
    id: "emailAutomation", title: "Email Automation", category: "automation",
    description: "Automatic emails for updates, receipts and follow-ups.",
    serviceName: "Email Automation Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["manual_updates", "has_business_email"],
    reason: "Updates are currently written and sent manually for every customer.",
    firstStep: "Automate your most frequent email updates.",
    laterStep: "Build a simple email sequence for new customers.",
  },
  crmAutomation: {
    id: "crmAutomation", title: "CRM / Customer Records System", category: "automation",
    description: "A simple system to store and organise customer information.",
    serviceName: "CRM Setup", importance: 7,
    applicableBusinessTypes: ["all"],
    triggers: ["no_enquiry_records", "team_size_medium_large"],
    reason: "With a growing team, customer information needs a shared, organised system rather than memory or chat history.",
    firstStep: "Set up a simple system to store customer details and history.",
    laterStep: "Add automatic reminders based on customer activity.",
  },
  inventoryAutomation: {
    id: "inventoryAutomation", title: "Inventory Automation", category: "automation",
    description: "Automatically updates stock levels as sales happen.",
    serviceName: "Inventory Automation", importance: 6,
    applicableBusinessTypes: ["fashion-clothing", "online-store", "retail-shop", "bakery-catering"],
    triggers: ["manual_stock_update"],
    reason: "Stock is currently updated by hand, which risks errors as sales increase.",
    firstStep: "Automate stock updates linked to your sales channel.",
    laterStep: "Add low-stock alerts sent automatically.",
  },
  customerEnquiryTracking: {
    id: "customerEnquiryTracking", title: "Customer Enquiry Tracking", category: "automation",
    description: "Keeps a record of every enquiry so none are lost.",
    serviceName: "Enquiry Tracking Setup", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["no_enquiry_records"],
    reason: "Enquiries aren't currently tracked, making it hard to know what's been followed up.",
    firstStep: "Set up a simple system to log every incoming enquiry.",
    laterStep: "Add status tags like new, in progress and closed.",
  },
  businessAnalytics: {
    id: "businessAnalytics", title: "Business Analytics", category: "automation",
    description: "Simple reports showing enquiries, sales and customer trends.",
    serviceName: "Business Analytics Setup", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["wants_reports", "goal_analytics"],
    reason: "Decisions are currently made without clear visibility into what's actually working.",
    firstStep: "Set up simple reporting on enquiries and sales.",
    laterStep: "Review reports monthly to guide business decisions.",
  },
  adminDashboard: {
    id: "adminDashboard", title: "Admin Dashboard", category: "automation",
    description: "A central dashboard to manage enquiries, orders and customers.",
    serviceName: "Admin Dashboard Build", importance: 9,
    applicableBusinessTypes: ["all"],
    triggers: ["wants_dashboard", "high_enquiry_volume"],
    reason: "Managing everything through chat apps alone becomes harder to scale as enquiries grow.",
    firstStep: "Build a simple dashboard to view and manage enquiries in one place.",
    laterStep: "Add order tracking and reporting to the same dashboard.",
  },

  // ---------------- BUSINESS GROWTH ----------------
  businessRegistrationGuidance: {
    id: "businessRegistrationGuidance", title: "Business Registration Guidance", category: "growth",
    description: "Simple guidance on registering the business officially.",
    serviceName: "Business Registration Guidance", importance: 7,
    applicableBusinessTypes: ["all"],
    triggers: ["not_registered", "unsure_registration"],
    reason: "Official registration builds trust with customers and unlocks access to more opportunities.",
    firstStep: "Get simple guidance on how to register the business.",
    laterStep: "Use the registered status to open a business bank account.",
  },
  businessGrowthPlan: {
    id: "businessGrowthPlan", title: "Business Growth Plan", category: "growth",
    description: "A simple step-by-step roadmap based on your goals and current state.",
    serviceName: "Business Growth Plan", importance: 8,
    applicableBusinessTypes: ["all"],
    triggers: ["many_missing_areas"],
    reason: "With several areas needing improvement, a clear roadmap helps prioritise what matters most.",
    firstStep: "Create a step-by-step growth plan based on your assessment results.",
    laterStep: "Review and adjust the plan every few months.",
  },
  digitalStrategy: {
    id: "digitalStrategy", title: "Digital Strategy Session", category: "growth",
    description: "A guided session to plan your digital presence and priorities.",
    serviceName: "Digital Strategy Session", importance: 5,
    applicableBusinessTypes: ["all"],
    triggers: ["needs_advice", "budget_unsure"],
    reason: "You mentioned needing advice first, so a strategy session can help clarify the right starting point.",
    firstStep: "Book a session to review your options and plan next steps.",
    laterStep: "Revisit the strategy as new goals emerge.",
  },
  customerJourneyImprovement: {
    id: "customerJourneyImprovement", title: "Customer Journey Improvement", category: "growth",
    description: "Reviewing and improving the full path from enquiry to sale.",
    serviceName: "Customer Journey Review", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["ordering_stressful", "abandoned_orders"],
    reason: "The current ordering process is causing stress and likely losing some customers along the way.",
    firstStep: "Map out and simplify the current ordering journey.",
    laterStep: "Test and refine the improved journey over time.",
  },
  loyaltyRewards: {
    id: "loyaltyRewards", title: "Loyalty Rewards Programme", category: "growth",
    description: "A simple system that rewards repeat customers.",
    serviceName: "Loyalty Programme Setup", importance: 4,
    applicableBusinessTypes: ["all"],
    triggers: ["no_loyalty_system"],
    reason: "Repeat customers currently receive no extra incentive to keep coming back.",
    firstStep: "Set up a simple points or discount-based loyalty system.",
    laterStep: "Promote the programme to your existing customer base.",
  },
  customerReviewCollection: {
    id: "customerReviewCollection", title: "Customer Review Collection", category: "growth",
    description: "A simple process to consistently collect and display reviews.",
    serviceName: "Review Collection System", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["no_reviews_collected"],
    reason: "Reviews are rarely collected, so potential customers see little social proof.",
    firstStep: "Set up a simple process to request reviews after every sale.",
    laterStep: "Display collected reviews across your platforms.",
  },
  marketingStrategy: {
    id: "marketingStrategy", title: "Marketing Strategy", category: "growth",
    description: "A focused plan for consistent, effective marketing.",
    serviceName: "Marketing Strategy Session", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["low_posting", "no_best_post_data"],
    reason: "Marketing currently happens without a clear plan or way to measure what's working.",
    firstStep: "Build a simple, focused marketing plan for the next quarter.",
    laterStep: "Review results monthly and refine the plan.",
  },
  salesProcessImprovement: {
    id: "salesProcessImprovement", title: "Sales Process Improvement", category: "growth",
    description: "Streamlining how a customer goes from interest to completed sale.",
    serviceName: "Sales Process Improvement", importance: 6,
    applicableBusinessTypes: ["all"],
    triggers: ["ordering_stressful", "abandoned_orders"],
    reason: "The path from enquiry to completed sale currently has friction that likely costs conversions.",
    firstStep: "Simplify the steps between enquiry and completed sale.",
    laterStep: "Automate the smoothed-out process where possible.",
  },
};

/* ============================================================
   8. BUSINESS TYPE RULES
   ============================================================
   Maps the human-readable business type (Step 2 select) to a
   normalised slug used across serviceKnowledgeBase.applicableBusinessTypes,
   plus a short list of "core tools" this type of business is
   generally expected to have. Missing a core tool weighs more
   heavily in scoring; missing an irrelevant tool is never penalised.
   ============================================================ */
const BUSINESS_TYPE_SLUGS = {
  "Fashion and clothing": "fashion-clothing",
  "Beauty and skincare": "beauty-skincare",
  "Hair salon": "hair-salon",
  "Barbering": "barbering",
  "Food and restaurant": "food-restaurant",
  "Bakery and catering": "bakery-catering",
  "Photography and videography": "photography-videography",
  "Event planning and decoration": "event-planning-decoration",
  "Real estate": "real-estate",
  "Hotel or short-let": "hotel-shortlet",
  "Health or pharmacy": "health-pharmacy",
  "Fitness": "fitness",
  "Education or training": "education-training",
  "School": "school",
  "Church or religious organisation": "church-religious",
  "NGO or foundation": "ngo-foundation",
  "Construction": "construction",
  "Architecture": "architecture",
  "Engineering": "engineering",
  "Cleaning services": "cleaning-services",
  "Professional services": "professional-services",
  "Consultant or coach": "consultant-coach",
  "Digital creator": "digital-creator",
  "Online store": "online-store",
  "Retail shop": "retail-shop",
  "Agriculture": "agriculture",
  "Transportation or logistics": "transportation-logistics",
  "Technology": "technology",
  "Other": "other",
};

// Core tools each business type is generally expected to have.
// Used to decide which "missing" signals matter most for scoring,
// so a business is never penalised for something irrelevant to it.
const BUSINESS_TYPE_CORE_TOOLS = {
  "food-restaurant": ["google_maps", "menu_display", "whatsapp_ordering", "reviews", "delivery_info", "product_photos"],
  "bakery-catering": ["google_maps", "menu_display", "whatsapp_ordering", "reviews", "delivery_info", "product_photos"],
  "hair-salon": ["booking", "location", "whatsapp", "reviews", "before_after_photos", "appointment_reminders"],
  "barbering": ["booking", "location", "whatsapp", "reviews", "before_after_photos", "appointment_reminders"],
  "beauty-skincare": ["booking", "location", "whatsapp", "reviews", "before_after_photos", "product_photos"],
  "fashion-clothing": ["online_store", "product_display", "prices", "payment", "delivery", "product_photos", "social_marketing"],
  "retail-shop": ["online_store", "product_display", "prices", "payment", "delivery", "product_photos", "social_marketing"],
  "online-store": ["online_store", "product_display", "prices", "payment", "delivery", "product_photos", "social_marketing"],
  "consultant-coach": ["branding", "company_profile", "website", "booking", "testimonials", "business_email"],
  "professional-services": ["branding", "company_profile", "website", "booking", "testimonials", "business_email"],
  "school": ["website", "admission_form", "contact_info", "google_location", "professional_email", "student_system"],
  "hotel-shortlet": ["booking_system", "google_maps", "room_gallery", "reviews", "payment", "email_confirmation"],
  "photography-videography": ["portfolio", "booking", "price_list", "social_proof", "before_after_work", "promo_content"],
  "cleaning-services": ["google_business_profile", "service_catalogue", "booking", "reviews", "before_after_photos", "service_area"],
};

// Returns a small object describing the business type context for
// scoring and recommendation logic.
function getBusinessTypeRequirements(businessType) {
  const slug = BUSINESS_TYPE_SLUGS[businessType] || "other";
  const coreTools = BUSINESS_TYPE_CORE_TOOLS[slug] || [];
  return { slug, coreTools };
}

/* ============================================================
   9. SCORE CALCULATION
   ============================================================
   Total: 100 points across 7 categories. Scoring is rule-based:
   it considers business type relevance, maturity, goals and
   customer volume alongside raw yes/no answers, rather than
   simply counting "yes" responses.
   ============================================================ */
function calculateCategoryScores(answers) {
  const { slug, coreTools } = getBusinessTypeRequirements(answers.businessType);
  const b = answers.branding || {};
  const o = answers.online || {};
  const m = answers.marketing || {};
  const c = answers.comms || {};
  const s = answers.sales || {};
  const a = answers.automation || {};

  const countYes = (obj, keys) => keys.filter((k) => obj[k] === true).length;
  const scoreFromRatio = (yesCount, totalCount, maxPoints) => {
    if (totalCount === 0) return maxPoints * 0.5; // neutral if nothing asked
    return Math.round((yesCount / totalCount) * maxPoints);
  };

  // ---- 1. Branding and Identity — 15 points ----
  const brandingKeys = ["hasLogo", "hasBrandColours", "consistentColours", "hasBrandFonts",
    "consistentSocialDesign", "hasBusinessCard", "hasInvoiceDesign", "hasReceiptDesign",
    "hasCompanyProfile", "hasBrandGuide", "looksProfessional"];
  let brandingScore = scoreFromRatio(countYes(b, brandingKeys), brandingKeys.length, 15);
  // Business maturity adjustment: newer businesses aren't penalised as harshly for gaps
  if (answers.businessAge === "Planning to start" || answers.businessAge === "Less than 6 months") {
    brandingScore = Math.min(15, brandingScore + 2);
  }

  // ---- 2. Online Presence — 15 points ----
  const onlineKeys = ["hasBio", "bioExplainsOffer", "bioHasCta", "hasBioLink", "hasWebsite",
    "websiteMobileFriendly", "websiteShowsAll", "hasDomain", "hasBusinessEmail",
    "listedOnGoogle", "correctGoogleLocation", "easyToFindContact", "getsGoogleEnquiries"];
  let onlineScore = scoreFromRatio(countYes(o, onlineKeys), onlineKeys.length, 15);
  // Businesses with a "local-business" style core requirement (salons, restaurants, etc.)
  // are weighted more heavily toward Google visibility specifically.
  const localBusinessSlugs = ["food-restaurant", "bakery-catering", "hair-salon", "barbering",
    "beauty-skincare", "cleaning-services", "hotel-shortlet"];
  if (localBusinessSlugs.includes(slug) && !o.listedOnGoogle) {
    onlineScore = Math.max(0, onlineScore - 2);
  }
  onlineScore = Math.max(0, Math.min(15, onlineScore));

  // ---- 3. Marketing and Content — 15 points ----
  const marketingKeys = ["hasPromoGraphics", "regularlyPromotes", "createsSaleDesigns",
    "usesPromoVideos", "clearProductPhotos", "postsIncludePrices", "postsHaveCta",
    "hasContentCalendar", "usesTestimonials", "showsBeforeAfter", "createsSeasonalPromos", "knowsBestPosts"];
  let marketingScore = scoreFromRatio(countYes(m, marketingKeys), marketingKeys.length, 15);
  const postingWeight = { "Daily": 1, "Several times a week": 0.85, "Weekly": 0.6, "Occasionally": 0.35, "Rarely": 0.15, "Never": 0 };
  const postingFactor = postingWeight[answers.postFrequency] ?? 0.5;
  marketingScore = Math.round(marketingScore * 0.7 + postingFactor * 15 * 0.3);
  marketingScore = Math.max(0, Math.min(15, marketingScore));

  // ---- 4. Customer Trust and Communication — 15 points ----
  const commsKeys = ["usesWhatsAppBusiness", "completeCatalogue", "usesQuickReplies",
    "hasWelcomeMessage", "hasAwayMessage", "displaysHours", "hasPriceList",
    "collectsReviews", "displaysTestimonials", "followsUpEnquiry", "followsUpSale",
    "hasLoyaltySystem", "keepsEnquiryRecords", "knowsReferralSource"];
  let commsScore = scoreFromRatio(countYes(c, commsKeys), commsKeys.length, 15);
  const replySpeedWeight = { "Immediately": 1, "Within 30 minutes": 0.9, "Within a few hours": 0.65, "Within 24 hours": 0.4, "Sometimes longer than 24 hours": 0.15 };
  const replyFactor = replySpeedWeight[answers.replySpeed] ?? 0.5;
  commsScore = Math.round(commsScore * 0.75 + replyFactor * 15 * 0.25);
  if (c.customersStopReplying === true) commsScore = Math.max(0, commsScore - 2);
  commsScore = Math.max(0, Math.min(15, commsScore));

  // ---- 5. Sales, Ordering and Payment — 15 points ----
  const salesKeys = ["catalogueVisible", "pricesDisplayed", "orderOnline", "bookOnline",
    "autoOrderConfirmation", "autoBookingConfirmation", "appointmentReminders", "payOnline",
    "providesReceipts", "paymentConfirmation", "tracksOrderProgress", "deliveryUpdates",
    "tracksStock", "usesCoupons", "hasCustomerDashboard"];
  // Filter relevant keys by sellsType so a pure-service business isn't scored on
  // stock tracking, and a pure-product business isn't scored on booking.
  let relevantSalesKeys = salesKeys;
  if (answers.sellsType === "Products") {
    relevantSalesKeys = salesKeys.filter((k) => !["bookOnline", "autoBookingConfirmation", "appointmentReminders"].includes(k));
  } else if (answers.sellsType === "Services") {
    relevantSalesKeys = salesKeys.filter((k) => !["tracksStock", "deliveryUpdates"].includes(k));
  }
  let salesScore = scoreFromRatio(countYes(s, relevantSalesKeys), relevantSalesKeys.length, 15);
  if (s.orderingStressful === true) salesScore = Math.max(0, salesScore - 2);
  if (s.hasAbandonedOrders === true) salesScore = Math.max(0, salesScore - 1);
  salesScore = Math.max(0, Math.min(15, salesScore));

  // ---- 6. Business Operations and Automation — 15 points ----
  const automationPositiveKeys = ["wantsAutoMessages", "wantsChatbot", "wantsAutoReminders",
    "wantsAutoFollowUp", "wantsAdminDashboard", "wantsReports", "usesManagementSoftware", "openToAutomation"];
  const automationNegativeKeys = ["losesToSlowReplies", "repeatedQuestionsTime", "forgetsFollowUp",
    "manualInvoices", "manualBookingConfirm", "manualStockUpdate", "manualUpdates"];
  // "usesManagementSoftware" being true is a genuine positive; the "wants X" answers
  // reflect readiness/openness rather than current state, so they count softly.
  const currentAutomationScore = automationNegativeKeys.length
    ? Math.round((1 - countYes(a, automationNegativeKeys) / automationNegativeKeys.length) * 10)
    : 5;
  const readinessScore = a.usesManagementSoftware ? 5 : (a.openToAutomation ? 3 : 1);
  let automationScore = Math.max(0, Math.min(15, currentAutomationScore + readinessScore));

  // ---- 7. Growth Planning and Analytics — 10 points ----
  let growthScore = 0;
  if (answers.registrationStatus === "Yes") growthScore += 3;
  else if (answers.registrationStatus === "Registration in progress") growthScore += 1.5;
  if (o.knowsVisitorCount) growthScore += 2;
  if (m.knowsBestPosts) growthScore += 2;
  if (c.keepsEnquiryRecords) growthScore += 1.5;
  if (a.wantsReports || a.usesManagementSoftware) growthScore += 1.5;
  growthScore = Math.max(0, Math.min(10, Math.round(growthScore)));

  return {
    branding: brandingScore,
    onlinePresence: onlineScore,
    marketing: marketingScore,
    communication: commsScore,
    sales: salesScore,
    automation: automationScore,
    growth: growthScore,
  };
}

function calculateAssessmentScore(answers) {
  const categoryScores = calculateCategoryScores(answers);
  const total = Object.values(categoryScores).reduce((sum, v) => sum + v, 0);
  return { total: Math.max(0, Math.min(100, Math.round(total))), categoryScores };
}

function getScoreLevel(score) {
  if (score <= 29) return {
    level: "Early Stage",
    message: "Your business is still building its foundation. This is a good time to put the most important tools in place step by step.",
  };
  if (score <= 49) return {
    level: "Developing",
    message: "Your business has started building an online presence, but some important areas still need attention.",
  };
  if (score <= 69) return {
    level: "Good Foundation",
    message: "Your business already has a good foundation. Improving a few important areas can make it look more professional and easier for customers to use.",
  };
  if (score <= 84) return {
    level: "Growth Ready",
    message: "Your business is in a strong position to grow. The next step is improving consistency, visibility and automation.",
  };
  return {
    level: "Strong Digital Business",
    message: "Your business has a strong digital setup. Advanced automation, analytics and marketing can help you scale further.",
  };
}

/* ============================================================
   10. STRENGTH DETECTION
   ============================================================ */
function identifyStrengths(answers) {
  const strengths = [];
  const b = answers.branding || {};
  const o = answers.online || {};
  const m = answers.marketing || {};
  const c = answers.comms || {};
  const s = answers.sales || {};

  if (b.hasLogo) strengths.push("You already have a business logo.");
  if (b.hasBrandColours && b.consistentColours) strengths.push("Your brand colours are consistent across your materials.");
  if (b.hasCompanyProfile) strengths.push("You have a company profile ready to share with clients.");
  if (b.looksProfessional) strengths.push("Your business already looks professional to customers.");

  if (o.hasWebsite) strengths.push("You already have your own website.");
  if (o.listedOnGoogle) strengths.push("Your business is listed on Google.");
  if (o.hasBusinessEmail) strengths.push("You have a professional business email address.");
  if (o.bioExplainsOffer) strengths.push("Your bio clearly explains what you offer.");

  if (answers.platforms?.includes("WhatsApp Business")) strengths.push("You use WhatsApp Business.");
  if ((answers.platforms || []).some((p) => ["Instagram", "Facebook", "TikTok"].includes(p))) {
    strengths.push("Your business has an active social media page.");
  }

  if (["Daily", "Several times a week"].includes(answers.postFrequency)) strengths.push("You post content consistently.");
  if (m.clearProductPhotos) strengths.push("Your product photos are clear and professional.");
  if (m.usesTestimonials) strengths.push("You use customer testimonials in your marketing.");

  if (["Immediately", "Within 30 minutes"].includes(answers.replySpeed)) strengths.push("Customers can contact you easily and get a fast reply.");
  if (c.followsUpEnquiry) strengths.push("You follow up with customers after an enquiry.");
  if (c.collectsReviews) strengths.push("You regularly collect customer reviews.");

  if (s.payOnline) strengths.push("Customers can already pay you online.");
  if (s.orderOnline || s.bookOnline) strengths.push("Customers can already order or book without lengthy back-and-forth.");

  if (answers.registrationStatus === "Yes") strengths.push("Your business is officially registered.");

  // Deduplicate defensively and cap so the result stays readable
  return Array.from(new Set(strengths)).slice(0, 8);
}

/* ============================================================
   11. MISSING-ITEM DETECTION
   ============================================================
   Produces two things:
     - missingItems: short, customer-friendly sentences
     - signals: a Set of trigger strings matched against
       serviceKnowledgeBase[...].triggers for recommendations
   ============================================================ */
function identifyMissingItems(answers) {
  const missingItems = [];
  const signals = new Set();
  const b = answers.branding || {};
  const o = answers.online || {};
  const m = answers.marketing || {};
  const c = answers.comms || {};
  const s = answers.sales || {};
  const a = answers.automation || {};

  if (!b.hasLogo) { missingItems.push("Your business does not yet have a logo."); signals.add("no_logo"); }
  if (b.hasLogo && b.satisfiedWithLogo === false) { signals.add("unsatisfied_logo"); }
  if (!b.hasBrandColours) { missingItems.push("Your business does not have fixed brand colours."); signals.add("no_brand_colours"); }
  if (b.hasBrandColours && !b.consistentColours) { signals.add("inconsistent_materials"); }
  if (!b.consistentSocialDesign) { signals.add("inconsistent_social_design"); }
  if (!b.hasBusinessCard) { signals.add("no_business_card"); }
  if (!b.hasLetterhead) { signals.add("no_letterhead"); }
  if (!b.hasInvoiceDesign) { signals.add("no_invoice_design"); }
  if (!b.hasReceiptDesign) { signals.add("no_receipt_design"); }
  if (!b.hasLabels) { signals.add("no_labels"); }
  if (!b.hasPackaging) { signals.add("no_packaging"); }
  if (!b.hasCompanyProfile) { missingItems.push("Your business does not have a company profile."); signals.add("no_company_profile"); }
  if (!b.hasBrandGuide) { signals.add("no_brand_guide"); }

  if (!o.hasBio) { signals.add("no_bio"); }
  if (o.hasBio && !o.bioExplainsOffer) { signals.add("weak_bio"); }
  if (o.hasBio && !o.bioHasCta) { signals.add("no_bio_cta"); }
  if (!o.hasBioLink) { signals.add("no_bio_link"); }
  if (!o.hasWebsite) { missingItems.push("Your business does not have its own website."); signals.add("no_website"); }
  if (o.hasWebsite) {
    signals.add("has_website");
    if (!o.websiteShowsAll) signals.add("website_incomplete");
  }
  if (!o.hasDomain) { signals.add("no_domain"); }
  if (!o.hasBusinessEmail) { signals.add("no_business_email"); } else { signals.add("has_business_email"); }
  if (!o.listedOnGoogle) { missingItems.push("Your business is not currently visible on Google."); signals.add("not_listed_google"); }
  if (o.listedOnGoogle && !o.correctGoogleLocation) { signals.add("wrong_google_location"); }
  if (!o.easyToFindContact) { signals.add("hard_to_find_contact"); }
  if (!o.getsGoogleEnquiries) { signals.add("no_google_enquiries"); }
  if (!o.knowsVisitorCount) { signals.add("no_visitor_data"); }

  if (["Rarely", "Never", "Occasionally"].includes(answers.postFrequency)) { signals.add("low_posting"); }
  if (!m.hasPromoGraphics) { signals.add("no_promo_graphics"); }
  if (!m.createsSaleDesigns) { signals.add("no_sale_designs"); }
  if (!m.usesPromoVideos) { signals.add("no_promo_videos"); }
  if (!m.clearProductPhotos) { missingItems.push("Your product pictures could look more clear and professional."); signals.add("unclear_photos"); }
  if (!m.postsHaveCta) { signals.add("no_posts_cta"); }
  if (!m.hasContentCalendar) { missingItems.push("Your promotional content is not currently planned in advance."); signals.add("no_content_calendar"); }
  if (!m.usesTestimonials) { signals.add("no_testimonials_used"); }
  if (!m.showsBeforeAfter) { signals.add("no_before_after"); }
  if (!m.createsSeasonalPromos) { signals.add("no_seasonal_promos"); }
  if (!m.knowsBestPosts) { signals.add("no_best_post_data"); }
  if (!(answers.contentTypes || []).includes("Educational content")) { signals.add("no_educational_content"); }

  if (!c.usesWhatsAppBusiness) { signals.add("no_whatsapp_business"); }
  if (c.usesWhatsAppBusiness && !c.completeCatalogue) { signals.add("incomplete_catalogue"); }
  if (!c.usesQuickReplies) { signals.add("no_quick_replies"); }
  if (!c.hasWelcomeMessage) { signals.add("no_welcome_message"); }
  if (!c.hasAwayMessage) { signals.add("no_away_message"); }
  if (c.repeatedQuestions) { signals.add("repeated_questions"); }
  if (!c.hasPriceList) { missingItems.push("You do not yet have a professional price list."); signals.add("no_price_list"); }
  if (!c.collectsReviews) { signals.add("no_reviews_collected"); }
  if (!c.followsUpEnquiry || !c.followsUpSale) {
    missingItems.push("Your customer follow-up process is currently manual.");
    signals.add("no_follow_up");
  }
  if (!c.hasLoyaltySystem) { signals.add("no_loyalty_system"); }
  if (c.customersStopReplying) { signals.add("customers_stop_replying"); }
  if (!c.keepsEnquiryRecords) { signals.add("no_enquiry_records"); }
  if (["Within 24 hours", "Sometimes longer than 24 hours"].includes(answers.replySpeed)) { signals.add("slow_replies"); }

  if (!s.catalogueVisible) { missingItems.push("Customers cannot view all your services in one place."); signals.add("no_catalogue_visible"); }
  if (!s.pricesDisplayed) { signals.add("no_prices_displayed"); }
  if (!s.orderOnline) { signals.add("no_order_online"); }
  if (!s.bookOnline && (answers.sellsType === "Services" || answers.sellsType === "Both")) { signals.add("no_online_booking"); }
  if (!s.autoOrderConfirmation) { signals.add("no_order_confirmation"); }
  if (!s.appointmentReminders && (answers.sellsType === "Services" || answers.sellsType === "Both")) { signals.add("no_appointment_reminders"); }
  if (!s.payOnline) { signals.add("no_pay_online"); }
  if (!s.deliveryUpdates) { signals.add("no_delivery_updates"); }
  if (!s.tracksStock && (answers.sellsType === "Products" || answers.sellsType === "Both")) { signals.add("no_stock_tracking"); }
  if (!s.usesCoupons) { signals.add("no_coupons_used"); }
  if (!s.hasCustomerDashboard) { signals.add("no_customer_dashboard"); }
  if (!s.paymentConfirmation) { signals.add("no_payment_confirmation"); }
  if (!s.autoBookingConfirmation) { signals.add("no_booking_confirmation"); }
  if (s.orderingStressful) { signals.add("ordering_stressful"); }
  if (s.hasAbandonedOrders) { signals.add("abandoned_orders"); }
  if ((answers.orderChannels || []).includes("WhatsApp message")) { signals.add("orders_via_whatsapp"); }

  if (answers.sellsType === "Products" || answers.sellsType === "Both") { signals.add("sells_products"); }
  if (answers.sellsType === "Services" || answers.sellsType === "Both") { signals.add("sells_services"); }
  if (answers.productCount === "1-10") signals.add("small_product_count");
  if (["11-50", "51-200"].includes(answers.productCount)) signals.add("medium_product_count");
  if (answers.productCount === "More than 200") signals.add("large_product_count");

  const product = answers.product || {};
  if (product.needsInventory) signals.add("needs_inventory");
  if (product.needsDeliveryTracking) signals.add("needs_delivery_tracking");
  const service = answers.service || {};
  if (service.needsBooking) signals.add("needs_booking");
  if (service.needsAutoReminders) signals.add("needs_auto_reminders");

  if (a.manualInvoices) signals.add("manual_invoices");
  if (a.manualBookingConfirm) signals.add("manual_booking_confirm");
  if (a.manualStockUpdate) signals.add("manual_stock_update");
  if (a.manualUpdates) signals.add("manual_updates");
  if (a.wantsChatbot) signals.add("wants_chatbot");
  if (a.wantsAutoFollowUp) signals.add("wants_follow_up");
  if (a.wantsAdminDashboard) signals.add("wants_dashboard");
  if (a.wantsReports) { signals.add("wants_reports"); missingItems.push("You don't currently have reports on enquiries, sales or customer activity."); }
  if (["31-50", "More than 50"].includes(answers.dailyEnquiries)) signals.add("high_enquiry_volume");

  if (["6-10 people", "11-25 people", "More than 25 people"].includes(answers.teamSize)) signals.add("team_size_medium_large");

  if (answers.registrationStatus === "No") { missingItems.push("Your business is not yet officially registered."); signals.add("not_registered"); }
  if (answers.registrationStatus === "Not sure how to register") signals.add("unsure_registration");

  if ((answers.improvementGoals || []).includes("Analytics")) signals.add("goal_analytics");
  if (answers.mainGoal === "Get more customers") signals.add("goal_more_customers");
  if (answers.mainGoal === "Become visible on Google") signals.add("goal_google_visibility");
  if (answers.mainGoal === "Build a website") signals.add("goal_build_website");
  if (answers.mainGoal === "Sell online") signals.add("goal_sell_online");
  if (answers.mainGoal === "Look more professional") signals.add("goal_look_professional");

  if (answers.budgetRange === "I need advice first") signals.add("needs_advice");
  if (answers.budgetRange === "I need advice first" || answers.budgetRange === "Under ₦25,000") signals.add("budget_unsure");
  if (answers.budgetRange === "Under ₦25,000") signals.add("budget_limited");

  return { missingItems: Array.from(new Set(missingItems)).slice(0, 8), signals };
}

/* ============================================================
   Areas that need attention (customer-friendly, broader than
   missingItems — groups related gaps into simple statements)
   ============================================================ */
function identifyImprovementAreas(answers, categoryScores) {
  const areas = [];
  const thresholds = { branding: 10, onlinePresence: 10, marketing: 10, communication: 10, sales: 10, automation: 9, growth: 6 };

  if (categoryScores.branding < thresholds.branding) areas.push("Your branding could look more consistent and professional.");
  if (categoryScores.onlinePresence < thresholds.onlinePresence) areas.push("Your business is not currently easy for new customers to find online.");
  if (categoryScores.marketing < thresholds.marketing) areas.push("Your promotional content is not consistent.");
  if (categoryScores.communication < thresholds.communication) areas.push("Your customer follow-up process is manual.");
  if (categoryScores.sales < thresholds.sales) areas.push("Ordering or booking currently takes more effort than it should.");
  if (categoryScores.automation < thresholds.automation) areas.push("Several daily tasks are still being done manually.");
  if (categoryScores.growth < thresholds.growth) areas.push("You don't yet have clear visibility into what's working in your business.");

  return areas.slice(0, 6);
}

/* ============================================================
   12. RECOMMENDATION GENERATION
   ============================================================
   Matches missing signals against serviceKnowledgeBase, filters by
   business type relevance, sorts by importance, then splits into
   Start First / Improve Next / Add Later.
   ============================================================ */
// Groups of services that are alternative tiers of the same underlying
// need (e.g. four different website/store "sizes"). Only the
// highest-importance match within a group should ever be recommended,
// so the customer never sees contradictory options like a "one-page
// store" alongside a "premium e-commerce website" in the same report.
const MUTUALLY_EXCLUSIVE_GROUPS = [
  ["simpleWebsite", "businessWebsite", "portfolioWebsite", "landingPage", "bookingWebsite"],
  ["productCatalogueWebsite", "onePageOnlineStore", "smallOnlineStore", "standardEcommerce", "premiumEcommerce"],
];

function dedupeMutuallyExclusive(matches) {
  const matchIds = new Set(matches.map((m) => m.id));
  const idsToDrop = new Set();

  MUTUALLY_EXCLUSIVE_GROUPS.forEach((group) => {
    const present = group.filter((id) => matchIds.has(id));
    if (present.length <= 1) return;
    // Keep only the highest-importance item in this group
    const best = present.reduce((a, b) =>
      serviceKnowledgeBase[b].importance > serviceKnowledgeBase[a].importance ? b : a
    );
    present.forEach((id) => { if (id !== best) idsToDrop.add(id); });
  });

  return matches.filter((m) => !idsToDrop.has(m.id));
}

function generateRecommendations(answers, signals) {
  const { slug } = getBusinessTypeRequirements(answers.businessType);

  let matches = Object.values(serviceKnowledgeBase).filter((service) => {
    const isRelevant = service.applicableBusinessTypes.includes("all") ||
      service.applicableBusinessTypes.includes(slug) ||
      service.applicableBusinessTypes.includes("local-business");
    if (!isRelevant) return false;
    return service.triggers.some((trigger) => signals.has(trigger));
  });

  matches = dedupeMutuallyExclusive(matches);

  // Sort by importance, descending
  matches.sort((a, b) => b.importance - a.importance);

  // Never recommend everything — cap the total and rely on importance sort
  const capped = matches.slice(0, 12);

  const startFirst = capped.slice(0, 4);
  const improveNext = capped.slice(4, 8);
  const addLater = capped.slice(8, 12);

  return { startFirst, improveNext, addLater, allMatches: capped };
}

/* ============================================================
   13. PACKAGE MATCHING
   ============================================================ */
const PACKAGES = {
  launch: { name: "Launch Package", price: "₦50,000", bestFor: "new businesses" },
  growth: { name: "Growth Package", price: "₦110,000", bestFor: "growing businesses" },
  elite: { name: "Elite Package", price: "₦250,000", bestFor: "businesses needing a complete setup" },
};

const BUDGET_MIN = {
  "Under ₦25,000": 0,
  "₦25,000-₦50,000": 25000,
  "₦50,000-₦100,000": 50000,
  "₦100,000-₦250,000": 100000,
  "₦250,000-₦500,000": 250000,
  "Above ₦500,000": 500000,
  "I need advice first": 0,
};

function chooseRecommendedPackage(answers, recommendations, categoryScores) {
  const missingCount = recommendations.allMatches.length;
  const budgetFloor = BUDGET_MIN[answers.budgetRange] ?? 0;
  const isNewBusiness = ["Planning to start", "Less than 6 months"].includes(answers.businessAge);
  const needsWebsite = recommendations.allMatches.some((s) => s.category === "online-presence");
  const needsAutomation = recommendations.allMatches.some((s) => s.category === "automation");
  const hasSomeBranding = (answers.branding || {}).hasLogo;

  let packageKey = null;
  let reason = "";

  if (answers.budgetRange === "I need advice first") {
    reason = "The customer wants to understand their options before committing to a package.";
    return { packageKey: null, packageName: null, reason };
  }

  if (missingCount >= 8 && budgetFloor >= 250000) {
    packageKey = "elite";
    reason = "The customer needs a complete setup across branding, online presence, marketing and automation, and the budget supports it.";
  } else if (missingCount >= 5 && budgetFloor >= 100000) {
    packageKey = "growth";
    reason = "The customer needs improvements across several categories, and the Growth Package covers the most impactful areas together.";
  } else if (isNewBusiness && budgetFloor <= 100000) {
    packageKey = "launch";
    reason = "As a newer business with foundational needs, the Launch Package covers the essentials to get started.";
  } else if (missingCount <= 3 || budgetFloor < 50000) {
    packageKey = null;
    reason = "The gaps identified are limited, or the budget fits better with one or two individual services rather than a full package.";
  } else {
    packageKey = "growth";
    reason = "The customer's needs span multiple categories, best covered by the Growth Package.";
  }

  if (!packageKey) {
    return { packageKey: null, packageName: null, reason };
  }
  return { packageKey, packageName: PACKAGES[packageKey].name, reason };
}

/* ============================================================
   14. WHATSAPP MESSAGE GENERATION
   ============================================================ */
// Converts a full sentence like "Your business does not have a website."
// into a short inline phrase like "no website in place", suitable for
// stitching into flowing prose (used only in the WhatsApp message).
function toShortPhrase(sentence) {
  return sentence
    .replace(/\.$/, "")
    .replace(/^Your business (does not|is not|are not)\s*/i, "no ")
    .replace(/^Your (does not have|does not|is not)\s*/i, "no ")
    .replace(/^You (do not|does not)\s*/i, "no ")
    .replace(/^Your /i, "")
    .replace(/^You /i, "")
    .replace(/^no have /i, "no ")
    .toLowerCase();
}

function generateWhatsAppMessage(answers, result) {
  const firstName = (answers.fullName || "there").split(" ")[0];
  const scoreLevelInfo = getScoreLevel(result.score);
  const strengthsList = result.strengths.slice(0, 3).map(toShortPhrase).join(", ") || "a growing business presence";
  const missingList = result.missingItems.slice(0, 3).map(toShortPhrase).join(", ") || "a few key areas";
  const firstSteps = result.recommendedFirstSteps.slice(0, 3).map((s) => toShortPhrase(s.firstStep)).join("; ") || "a few quick wins";
  const packageOrService = result.recommendedPackage || (result.recommendedServices[0] ?? "a starting service");

  return `Hi ${firstName} 😊

Thank you for completing the HoblemercyTech Business Growth Assessment.

Your business scored ${result.score}/100, which means your business is at the "${scoreLevelInfo.level}" stage.

I noticed that you already have ${strengthsList}.

However, your business could still improve in areas such as ${missingList}.

Since your main goal is ${answers.mainGoal || "growing your business"}, I recommend starting with ${firstSteps}.

These steps can make it easier for customers to find your business, trust your brand and place an order or booking.

Based on your answers and budget, ${packageOrService} may be a suitable place to start.

You do not need to do everything at once. We can begin with the most important area and improve the rest step by step.

Let me know which recommendation you would like me to explain first. 😊`;
}

/* ============================================================
   Orchestrator: runs the full analysis pipeline and stores it
   on state.result
   ============================================================ */
function computeAssessmentResult() {
  const answers = state.answers;
  const { total, categoryScores } = calculateAssessmentScore(answers);
  const scoreLevelInfo = getScoreLevel(total);
  const strengths = identifyStrengths(answers);
  const { missingItems, signals } = identifyMissingItems(answers);
  const improvementAreas = identifyImprovementAreas(answers, categoryScores);
  const recommendations = generateRecommendations(answers, signals);
  const packageChoice = chooseRecommendedPackage(answers, recommendations, categoryScores);

  const recommendedServices = recommendations.allMatches.map((s) => s.serviceName);

  const result = {
    score: total,
    scoreLevel: scoreLevelInfo.level,
    scoreMessage: scoreLevelInfo.message,
    categoryScores,
    strengths,
    missingItems,
    improvementAreas,
    recommendedFirstSteps: recommendations.startFirst,
    recommendedLaterSteps: [...recommendations.improveNext, ...recommendations.addLater],
    recommendedServices,
    recommendedPackage: packageChoice.packageName,
    recommendationReason: packageChoice.reason,
  };

  result.whatsappMessage = generateWhatsAppMessage(answers, result);
  state.result = result;
  return result;
}

/* ============================================================
   15. PREVIEW RENDERING
   ============================================================ */
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function renderTagList(items) {
  if (!items || items.length === 0) return `<span class="preview-tag">None recorded</span>`;
  return items.map((item) => `<span class="preview-tag">${escapeHtml(item)}</span>`).join("");
}

function renderAssessmentPreview() {
  const answers = state.answers;
  const result = state.result;
  if (!result) return;

  const contactLine = [answers.phone, answers.email].filter(Boolean).map(escapeHtml).join(" · ") || "Not provided";

  els.previewContent.innerHTML = `
    <div class="preview-card">
      <h3>Your details</h3>
      <div class="preview-row"><dt>Full name</dt><dd>${escapeHtml(answers.fullName)}</dd></div>
      <div class="preview-row"><dt>Business name</dt><dd>${escapeHtml(answers.businessName)}</dd></div>
      <div class="preview-row"><dt>Business type</dt><dd>${escapeHtml(answers.businessType === "Other" ? answers.businessTypeOther : answers.businessType)}</dd></div>
      <div class="preview-row"><dt>Contact</dt><dd>${contactLine}</dd></div>
    </div>

    <div class="preview-card">
      <h3>Goals & challenge</h3>
      <div class="preview-row"><dt>Main goal</dt><dd>${escapeHtml(answers.mainGoal)}</dd></div>
      <div class="preview-row"><dt>Biggest challenge</dt><dd>${escapeHtml(answers.biggestChallenge)}</dd></div>
      <div class="preview-row"><dt>Budget</dt><dd>${escapeHtml(answers.budgetRange)}</dd></div>
      <div class="preview-row"><dt>Timeline</dt><dd>${escapeHtml(answers.timeline)}</dd></div>
      <p style="margin-top:10px; font-size:0.85rem; color:var(--text-secondary);">Areas you'd like to improve:</p>
      <div class="preview-tag-list">${renderTagList(answers.improvementGoals)}</div>
    </div>

    <div class="preview-card">
      <h3>Your Growth Readiness Score</h3>
      <div class="preview-row"><dt>Score</dt><dd>${result.score}/100 — ${escapeHtml(result.scoreLevel)}</dd></div>
      <p style="margin-top:10px; font-size:0.85rem; color:var(--text-secondary);">What you're already doing well:</p>
      <div class="preview-tag-list">${renderTagList(result.strengths.slice(0, 5))}</div>
      <p style="margin-top:10px; font-size:0.85rem; color:var(--text-secondary);">Areas needing improvement:</p>
      <div class="preview-tag-list">${renderTagList(result.improvementAreas.slice(0, 5))}</div>
      <p style="margin-top:10px; font-size:0.85rem; color:var(--text-secondary);">What your business needs:</p>
      <div class="preview-tag-list">${renderTagList(result.recommendedFirstSteps.map((s) => s.title))}</div>
    </div>
  `;
}

/* ============================================================
   Result screen rendering (shown after successful submission)
   ============================================================ */
function renderResultScreen() {
  const result = state.result;
  const answers = state.answers;
  if (!result) return;

  const circumference = 2 * Math.PI * 80;
  const offset = circumference * (1 - result.score / 100);
  const firstName = escapeHtml((answers.fullName || "").split(" ")[0] || "there");

  els.resultContent.innerHTML = `
    <svg width="0" height="0" style="position:absolute;">
      <defs>
        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#7C3AED" />
          <stop offset="100%" stop-color="#A855F7" />
        </linearGradient>
      </defs>
    </svg>

    <div class="score-ring-wrap">
      <svg viewBox="0 0 180 180">
        <circle class="score-ring-bg" cx="90" cy="90" r="80" />
        <circle class="score-ring-fill" cx="90" cy="90" r="80"
          stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" />
      </svg>
      <div class="score-ring-label">
        <span class="score-ring-number">${result.score}</span>
        <span class="score-ring-total">out of 100</span>
      </div>
    </div>

    <span class="score-level-badge">${escapeHtml(result.scoreLevel)}</span>
    <p class="score-message">${escapeHtml(result.scoreMessage)}</p>

    <div class="result-section strengths">
      <h3><i class="fa-solid fa-circle-check" aria-hidden="true"></i> What you are already doing well</h3>
      <ul>${result.strengths.slice(0, 6).map((s) => `<li><i class="fa-solid fa-check" aria-hidden="true"></i><span>${escapeHtml(s)}</span></li>`).join("") || "<li>We'll highlight your strengths as your business grows.</li>"}</ul>
    </div>

    <div class="result-section improve">
      <h3><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Areas that need attention</h3>
      <ul>${result.improvementAreas.slice(0, 6).map((s) => `<li><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><span>${escapeHtml(s)}</span></li>`).join("")}</ul>
    </div>

    <div class="result-section needs">
      <h3><i class="fa-solid fa-list-check" aria-hidden="true"></i> What your business needs</h3>
      <ul>${result.recommendedFirstSteps.map((s) => `<li><i class="fa-solid fa-star" aria-hidden="true"></i><span>${escapeHtml(s.title)}</span></li>`).join("")}</ul>
    </div>

    <p class="score-message">Your business already has some good tools in place. Improving the areas above can make it easier for customers to find you, trust your business and complete an order or booking.</p>

    <div class="success-card">
      <h3>Thank you, ${firstName}!</h3>
      <p>Your assessment has been received. HoblemercyTech will review your score, goals and challenges and contact you through ${escapeHtml(answers.preferredContact || "your preferred contact method")}.</p>
    </div>

    <p style="font-size:0.8rem; color:var(--text-muted);">This score is a digital business readiness guide, not a guarantee of sales or business success.</p>

    <button type="button" class="restart-link" id="restartAssessmentBtn">Start a new assessment</button>
  `;

  // Animate the ring after paint
  requestAnimationFrame(() => {
    const fillEl = els.resultContent.querySelector(".score-ring-fill");
    if (fillEl) fillEl.style.strokeDashoffset = String(offset);
  });

  document.getElementById("restartAssessmentBtn")?.addEventListener("click", () => {
    window.location.reload();
  });
}

/* ============================================================
   16. SUPABASE SUBMISSION
   ============================================================ */
function generateSubmissionToken() {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildAssessmentRecord() {
  const answers = state.answers;
  const result = state.result;

  return {
    full_name: answers.fullName,
    business_name: answers.businessName,
    phone: answers.phone,
    email: answers.email || null,
    preferred_contact_method: answers.preferredContact,
    state: answers.state,
    city: answers.city,
    address: answers.address || null,
    social_link: answers.socialLink || null,

    business_type: answers.businessType === "Other" ? answers.businessTypeOther : answers.businessType,
    business_type_other: answers.businessType === "Other" ? answers.businessTypeOther : null,
    business_description: answers.businessDescription,
    target_customers: answers.targetCustomers,
    business_age: answers.businessAge,
    team_size: answers.teamSize,
    registration_status: answers.registrationStatus,

    branding_answers: { ...answers.branding, brandFeeling: answers.brandFeeling },
    online_presence_answers: { ...answers.online, platforms: answers.platforms, onlineProblem: answers.onlineProblem },
    marketing_answers: { ...answers.marketing, postFrequency: answers.postFrequency, contentTypes: answers.contentTypes, marketingChallenge: answers.marketingChallenge },
    communication_answers: { ...answers.comms, contactChannels: answers.contactChannels, replySpeed: answers.replySpeed, commonQuestions: answers.commonQuestions },
    sales_answers: { ...answers.sales, sellsType: answers.sellsType, orderChannels: answers.orderChannels, productCount: answers.productCount, product: answers.product, service: answers.service, orderJourney: answers.orderJourney },
    automation_answers: { ...answers.automation, manualTasks: answers.manualTasks, dailyEnquiries: answers.dailyEnquiries, timeStress: answers.timeStress },

    main_goal: answers.mainGoal,
    improvement_goals: answers.improvementGoals,
    biggest_challenge: answers.biggestChallenge,
    previous_attempts: answers.previousAttempts || null,
    success_definition: answers.successDefinition,
    budget_range: answers.budgetRange,
    timeline: answers.timeline,
    readiness_level: answers.readinessLevel,
    final_narration: answers.finalNarration || null,
    consent_contact: answers.consentContact,
    consent_follow_up: answers.consentFollowUp,

    score: result.score,
    score_level: result.scoreLevel,
    category_scores: result.categoryScores,
    strengths: result.strengths,
    missing_items: result.missingItems,
    improvement_areas: result.improvementAreas,
    recommended_services: result.recommendedServices,
    recommended_first_steps: result.recommendedFirstSteps.map((s) => ({ title: s.title, firstStep: s.firstStep, reason: s.reason })),
    recommended_later_steps: result.recommendedLaterSteps.map((s) => ({ title: s.title, laterStep: s.laterStep })),
    recommended_package: result.recommendedPackage,
    recommendation_reason: result.recommendationReason,
    whatsapp_message: result.whatsappMessage,

    submission_token: state.submissionToken,
  };
}

async function saveAssessment(record) {
  const client = await getSupabaseClient();

  // Generate the row's id on the client instead of relying on Postgres's
  // default and reading it back afterward. PostgREST implements
  // `.select()` after an insert as an INSERT-then-SELECT — and a SELECT
  // requires its own RLS policy. Anonymous visitors intentionally have no
  // SELECT policy on this table (see supabase.sql), so `.select()` here
  // would always fail with a misleading "row-level security" error even
  // though the insert itself is fully permitted. Supplying our own id and
  // skipping `.select()` avoids needing a SELECT policy at all.
  const generatedId = (window.crypto?.randomUUID?.() ?? generateSubmissionToken());
  const recordWithId = { id: generatedId, ...record };

  const { error } = await client
    .from("business_assessments")
    .insert(recordWithId);

  if (error) throw error;
  return { id: generatedId };
}

/* ============================================================
   17. EDGE FUNCTION CALL
   ============================================================ */
async function notifyAdmin(assessmentId) {
  const client = await getSupabaseClient();
  const { data, error } = await client.functions.invoke(EDGE_FUNCTION_NAME, {
    body: { assessmentId },
  });
  if (error) {
    // Don't fail the whole submission if only the notification email fails —
    // the assessment itself has already been saved successfully.
    console.error("Admin notification failed:", error);
    return { ok: false };
  }
  return data;
}

/* ============================================================
   Final submission handler (wires steps 11-14 of spec together)
   ============================================================ */
async function handleSubmitAssessment() {
  if (state.isSubmitting) return;

  // Basic spam protection: honeypot must be empty
  const honeypot = document.getElementById("websiteHp");
  if (honeypot && honeypot.value.trim().length > 0) {
    console.warn("Honeypot field was filled; likely a bot submission. Aborting silently.");
    return;
  }

  // Basic spam protection: throttle rapid resubmission
  const lastSubmitKey = "hoblemercy_last_submit_time";
  const lastSubmit = Number(localStorage.getItem(lastSubmitKey) || 0);
  if (Date.now() - lastSubmit < 5000) {
    showToast("Please wait a moment before submitting again.", "error");
    return;
  }

  state.isSubmitting = true;
  state.submissionToken = state.submissionToken || generateSubmissionToken();
  setSubmitButtonLoading(true);

  try {
    const record = buildAssessmentRecord();
    const saved = await saveAssessment(record);
    localStorage.setItem(lastSubmitKey, String(Date.now()));

    // Fire-and-forget-ish: awaited, but its failure doesn't block success UI
    await notifyAdmin(saved.id);

    showToast(
  "Your Business Growth Analysis has been submitted successfully. HoblemercyTech will review your report and contact you with personalized recommendations.",
  "success"
);

/*
  Clear the saved draft only after the database submission
  and admin notification process have completed.
*/

clearDraft();

renderResultScreen();
goToStep("result");
  } catch (err) {
    console.error("Failed to submit assessment:", err);
    showToast("We couldn't submit your assessment. Please check your connection and try again.", "error");
  } finally {
    state.isSubmitting = false;
    setSubmitButtonLoading(false);
  }
}

function setSubmitButtonLoading(isLoading) {
  const label = els.submitBtn.querySelector(".btn-label");
  const spinner = els.submitBtn.querySelector(".btn-spinner");
  els.submitBtn.disabled = isLoading;
  label.hidden = isLoading;
  spinner.hidden = !isLoading;
}

/* ============================================================
   18. TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`.trim();
  toast.setAttribute("role", "status");
  const icon = type === "error" ? "fa-circle-exclamation" : "fa-circle-check";
  toast.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

/* ============================================================
   19. THEME HANDLING
   ============================================================ */
function initTheme() {
  const stored = localStorage.getItem("hoblemercy_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = stored || (prefersDark ? "dark" : "light");
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("hoblemercy_theme", theme);
  const icon = document.getElementById("themeIcon");
  const toggleBtn = document.getElementById("themeToggle");
  if (icon) icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  if (toggleBtn) toggleBtn.setAttribute("aria-pressed", String(theme === "dark"));
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
}

/* ============================================================
   20. ERROR HANDLING (global safety net)
   ============================================================ */
window.addEventListener("error", (event) => {
  console.error("Unhandled error:", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

/* ============================================================
   INITIALISATION & EVENT WIRING
   ============================================================ */
function restoreFormFieldsFromState() {
  const a = state.answers;
  const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };
  const setChecked = (name, values) => {
    if (!values) return;
    els.form.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
      el.checked = values.includes(el.value);
    });
  };
  const setRadio = (name, value) => {
    if (!value) return;
    const el = els.form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
    if (el) el.checked = true;
  };

  setVal("fullName", a.fullName);
  setVal("businessName", a.businessName);
  setVal("phone", a.phone);
  setVal("email", a.email);
  setRadio("preferredContact", a.preferredContact);
  setVal("state", a.state);
  setVal("city", a.city);
  setVal("address", a.address);
  setVal("socialLink", a.socialLink);

  setVal("businessType", a.businessType);
  document.getElementById("businessTypeOtherWrap").hidden = a.businessType !== "Other";
  setVal("businessTypeOther", a.businessTypeOther);
  setVal("businessDescription", a.businessDescription);
  setChecked("targetCustomers", a.targetCustomers);
  setVal("businessAge", a.businessAge);
  setVal("teamSize", a.teamSize);
  setRadio("registrationStatus", a.registrationStatus);

  setVal("brandFeeling", a.brandFeeling);

  setChecked("platforms", a.platforms);
  setVal("onlineProblem", a.onlineProblem);

  setVal("postFrequency", a.postFrequency);
  setChecked("contentTypes", a.contentTypes);
  setVal("marketingChallenge", a.marketingChallenge);

  setChecked("contactChannels", a.contactChannels);
  setVal("replySpeed", a.replySpeed);
  setVal("commonQuestions", a.commonQuestions);

  setRadio("sellsType", a.sellsType);
  setChecked("orderChannels", a.orderChannels);
  setVal("productCount", a.productCount);
  setVal("orderJourney", a.orderJourney);
  applyConditionalLogic();

  setChecked("manualTasks", a.manualTasks);
  setVal("dailyEnquiries", a.dailyEnquiries);
  setVal("timeStress", a.timeStress);

  setVal("mainGoal", a.mainGoal);
  setChecked("improvementGoals", a.improvementGoals);
  setVal("biggestChallenge", a.biggestChallenge);
  setVal("previousAttempts", a.previousAttempts);
  setVal("successDefinition", a.successDefinition);
  setVal("budgetRange", a.budgetRange);
  setVal("timeline", a.timeline);
  setRadio("readinessLevel", a.readinessLevel);
  setVal("finalNarration", a.finalNarration);
  document.getElementById("consentContact").checked = !!a.consentContact;
  document.getElementById("consentFollowUp").checked = !!a.consentFollowUp;

  restoreYesNoUI();
}

function beginAssessment() {
  els.hero.hidden = true;
  els.assessmentSection.hidden = false;
  goToStep(state.currentStep || 1);
}

function setupHeaderInteractions() {
  const themeToggle = document.getElementById("themeToggle");
  themeToggle.addEventListener("click", toggleTheme);

  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mainNav = document.getElementById("mainNav");
  mobileMenuBtn.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
  });
  mainNav.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");
      mobileMenuBtn.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelector('a[href="#assessment"]')?.addEventListener("click", (e) => {
    e.preventDefault();
    beginAssessment();
  });
}

function init() {
  document.getElementById("footerYear").textContent = String(new Date().getFullYear());
  initTheme();
  renderYesNoLists();
  setupBusinessTypeOther();
  setupSellsTypeListener();
  setupLiveErrorClearing();
  setupDraftAutoSave();
  setupHeaderInteractions();

  els.startBtn.addEventListener("click", beginAssessment);
  els.continueBtn.addEventListener("click", handleContinue);
  els.backBtn.addEventListener("click", handleBack);
  els.submitBtn.addEventListener("click", handleSubmitAssessment);

  // Prevent native form submission (Enter key) from reloading the page;
  // route it through the same validated continue/submit flow instead.
  els.form.addEventListener("submit", (e) => e.preventDefault());

  // Restore any saved draft
  const hadDraft = restoreDraft();
  if (hadDraft) {
    restoreFormFieldsFromState();
    showToast(
  "Good to see you again! Your saved progress has been restored.",
  "success"
);
  }
}

document.addEventListener("DOMContentLoaded", init);