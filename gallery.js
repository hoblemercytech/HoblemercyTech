/* ============================================================
   HOBLEMERCYTECH PUBLIC GALLERY
   STEP 3 — COMPLETE JAVASCRIPT
============================================================ */


/* ============================================================
   SUPABASE CONFIGURATION
============================================================ */

const SUPABASE_URL = 'https://kwxgaoyjbkawerguljtx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3eGdhb3lqYmthd2VyZ3VsanR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDI1MTAsImV4cCI6MjA5NzM3ODUxMH0.v39YkkhMsfwBJwPWbSdDjqHRozV9h6FdEhtM5KxakVI';


/* ============================================================
   DOM HELPER
============================================================ */

const $ = id =>
  document.getElementById(id);
  
  
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


/* ============================================================
   GALLERY STATE
============================================================ */

let publicGalleryCategories = [];
let publicGalleryProjects = [];
let publicGalleryImages = [];

let filteredGalleryProjects = [];

let activeGalleryCategory = "all";
let publicGallerySearchTerm = "";

let visibleProjectLimit = 9;
const PROJECTS_PER_PAGE = 9;

let activeModalProject = null;
let activeModalImages = [];
let activeModalImageIndex = 0;

let lastFocusedGalleryElement = null;


/* ============================================================
   SAFE HTML
============================================================ */

const escapeGalleryHTML = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");


/* ============================================================
   DATE FORMATTER
============================================================ */

const formatGalleryDate = value => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  ).format(date);
};


/* ============================================================
   SUPABASE PUBLIC FETCH
============================================================ */

const publicGalleryFetch = async path => {
  const response = await fetch(
    `${SUPABASE_URL}${path}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization:
          `Bearer ${SUPABASE_ANON_KEY}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      await readPublicGalleryError(
        response
      )
    );
  }

  return response.json();
};


const readPublicGalleryError =
  async response => {
    try {
      const data =
        await response.json();

      return (
        data.message ||
        data.error_description ||
        data.hint ||
        `Gallery request failed (${response.status}).`
      );

    } catch {
      return (
        `Gallery request failed (${response.status}).`
      );
    }
  };


/* ============================================================
   LOAD GALLERY DATA
============================================================ */

const loadPublicGallery = async () => {
  showPublicGalleryLoading();

  try {
    const [
      categories,
      projects,
      images
    ] = await Promise.all([

      publicGalleryFetch(
        "/rest/v1/gallery_categories" +
        "?select=*" +
        "&is_active=eq.true" +
        "&order=sort_order.asc,name.asc"
      ),

      publicGalleryFetch(
        "/rest/v1/gallery_projects" +
        "?select=*" +
        "&status=eq.published" +
        "&order=sort_order.asc,created_at.desc"
      ),

      publicGalleryFetch(
        "/rest/v1/gallery_images" +
        "?select=*" +
        "&order=display_order.asc,created_at.asc"
      )

    ]);

    publicGalleryCategories =
      Array.isArray(categories)
        ? categories
        : [];

    publicGalleryProjects =
      Array.isArray(projects)
        ? projects
        : [];

    publicGalleryImages =
      Array.isArray(images)
        ? images
        : [];


    hideAllPublicGalleryStates();

    renderPublicGalleryFilters();
    updatePublicGalleryCounts();
    renderFeaturedGalleryProject();

    activeGalleryCategory = "all";
    publicGallerySearchTerm = "";
    visibleProjectLimit =
      PROJECTS_PER_PAGE;

    if ($("publicGallerySearch")) {
      $("publicGallerySearch").value = "";
    }

    applyPublicGalleryFilters();

  } catch (error) {
    console.error(
      "Public gallery loading error:",
      error
    );

    hideAllPublicGalleryStates();

    if ($("publicGalleryError")) {
      $("publicGalleryError").hidden =
        false;
    }

    showGalleryToast(
      error.message ||
      "The gallery could not be loaded.",
      "error"
    );
  }
};


/* ============================================================
   LOADING AND STATES
============================================================ */

const showPublicGalleryLoading = () => {
  hideAllPublicGalleryStates();

  if ($("publicGalleryLoading")) {
    $("publicGalleryLoading").hidden =
      false;
  }

  if ($("publicGalleryGrid")) {
    $("publicGalleryGrid").innerHTML =
      "";
  }

  if ($("publicGalleryLoadMoreWrap")) {
    $("publicGalleryLoadMoreWrap").hidden =
      true;
  }
};


const hideAllPublicGalleryStates = () => {
  [
    "publicGalleryLoading",
    "publicGalleryError",
    "publicGalleryEmpty",
    "publicGalleryNoResults"
  ].forEach(id => {
    const element = $(id);

    if (element) {
      element.hidden = true;
    }
  });
};


/* ============================================================
   CATEGORY AND IMAGE HELPERS
============================================================ */

const getPublicGalleryCategory =
  categoryId =>
    publicGalleryCategories.find(
      category =>
        String(category.id) ===
        String(categoryId)
    ) || null;


const getPublicGalleryProjectImages =
  projectId =>
    publicGalleryImages
      .filter(
        image =>
          String(image.project_id) ===
          String(projectId)
      )
      .sort(
        (a, b) =>
          Number(a.display_order || 0) -
          Number(b.display_order || 0)
      );


const getPublicGalleryCover =
  project => {
    const projectImages =
      getPublicGalleryProjectImages(
        project.id
      );

    return (
      project.cover_image_url ||
      projectImages.find(
        image => image.is_cover
      )?.image_url ||
      projectImages[0]?.image_url ||
      ""
    );
  };


const getPublicGalleryImageCount =
  projectId =>
    getPublicGalleryProjectImages(
      projectId
    ).length;


/* ============================================================
   PROJECT COUNTS
============================================================ */

const updatePublicGalleryCounts = () => {
  const count =
    publicGalleryProjects.length;

  if ($("publicGalleryProjectCount")) {
    $("publicGalleryProjectCount")
      .textContent = count;
  }

  if ($("heroProjectCount")) {
    $("heroProjectCount").textContent =
      count > 0
        ? `${count} Creative ${
            count === 1
              ? "Project"
              : "Projects"
          }`
        : "Creative Portfolio";
  }
};


/* ============================================================
   CATEGORY FILTER BUTTONS
============================================================ */

const renderPublicGalleryFilters = () => {
  const container =
    $("publicGalleryFilters");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <button
      type="button"
      class="public-gallery-filter active"
      data-gallery-category="all"
      aria-pressed="true"
    >
      <i class="fas fa-border-all"></i>
      All Projects
    </button>

    ${publicGalleryCategories
      .map(category => `
        <button
          type="button"
          class="public-gallery-filter"
          data-gallery-category="${escapeGalleryHTML(
            category.id
          )}"
          aria-pressed="false"
        >
          <i class="fas ${escapeGalleryHTML(
            category.icon ||
            "fa-folder-open"
          )}"></i>

          ${escapeGalleryHTML(
            category.name
          )}
        </button>
      `)
      .join("")}
  `;
};


/* ============================================================
   FEATURED PROJECT
============================================================ */

const renderFeaturedGalleryProject =
  () => {
    const section =
      $("publicFeaturedProject");

    const container =
      $("featuredProjectContent");

    if (!section || !container) {
      return;
    }

    const featuredProject =
      publicGalleryProjects.find(
        project => project.is_featured
      );

    if (!featuredProject) {
      section.hidden = true;
      container.innerHTML = "";
      return;
    }

    const category =
      getPublicGalleryCategory(
        featuredProject.category_id
      );

    const imageCount =
      getPublicGalleryImageCount(
        featuredProject.id
      );

    const cover =
      getPublicGalleryCover(
        featuredProject
      );

    const date =
      formatGalleryDate(
        featuredProject.project_date ||
        featuredProject.created_at
      );

    section.hidden = false;

    container.innerHTML = `
      <div class="featured-project-image gallery-image-loading">

        ${
          cover
            ? `
              <img
                src="${escapeGalleryHTML(cover)}"
                alt="${escapeGalleryHTML(
                  featuredProject.title
                )}"
                loading="lazy"
              >
            `
            : `
              <div class="public-gallery-card-placeholder">
                <i class="far fa-image"></i>
                <span>No cover image</span>
              </div>
            `
        }

        <span class="featured-project-image-badge">
          <i class="fas ${escapeGalleryHTML(
            category?.icon ||
            "fa-star"
          )}"></i>

          ${escapeGalleryHTML(
            category?.name ||
            "Creative Project"
          )}
        </span>

        <span class="featured-project-image-count">
          <i class="fas fa-images"></i>

          ${imageCount}
          ${
            imageCount === 1
              ? "image"
              : "images"
          }
        </span>

      </div>

      <div class="featured-project-details">

        <span class="featured-project-category">
          <i class="fas fa-star"></i>
          Featured Collection
        </span>

        <h3>
          ${escapeGalleryHTML(
            featuredProject.title
          )}
        </h3>

        <p>
          ${escapeGalleryHTML(
            featuredProject.description ||
            "Explore this selected creative project from HoblemercyTech."
          )}
        </p>

        <div class="featured-project-meta">

          ${
            featuredProject.client_name
              ? `
                <span>
                  <i class="far fa-user"></i>
                  ${escapeGalleryHTML(
                    featuredProject.client_name
                  )}
                </span>
              `
              : ""
          }

          ${
            date
              ? `
                <span>
                  <i class="far fa-calendar"></i>
                  ${escapeGalleryHTML(date)}
                </span>
              `
              : ""
          }

          <span>
            <i class="fas fa-images"></i>

            ${imageCount}
            ${
              imageCount === 1
                ? "image"
                : "images"
            }
          </span>

        </div>

        <div class="featured-project-actions">

          <button
            type="button"
            class="gallery-primary-btn"
            data-open-public-project="${escapeGalleryHTML(
              featuredProject.id
            )}"
          >
            <i class="fas fa-images"></i>
            View Full Project
          </button>

          <a
            href="${createProjectWhatsAppURL(
              featuredProject
            )}"
            target="_blank"
            rel="noopener"
            class="gallery-secondary-btn"
          >
            <i class="fab fa-whatsapp"></i>
            Book Similar
          </a>

        </div>

      </div>
    `;

    initialiseGalleryImages(
      container
    );
  };


/* ============================================================
   FILTER PROJECTS
============================================================ */

const applyPublicGalleryFilters = () => {
  const search =
    publicGallerySearchTerm
      .trim()
      .toLowerCase();

  filteredGalleryProjects =
    publicGalleryProjects.filter(
      project => {
        const category =
          getPublicGalleryCategory(
            project.category_id
          );

        const searchableContent = [
          project.title,
          project.description,
          project.client_name,
          category?.name
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !search ||
          searchableContent.includes(
            search
          );

        const matchesCategory =
          activeGalleryCategory ===
            "all" ||
          String(project.category_id) ===
            String(
              activeGalleryCategory
            );

        return (
          matchesSearch &&
          matchesCategory
        );
      }
    );

  renderPublicGalleryProjects();
};


/* ============================================================
   RENDER PROJECT CARDS
============================================================ */

const renderPublicGalleryProjects =
  () => {
    const grid =
      $("publicGalleryGrid");

    if (!grid) {
      return;
    }

    hideAllPublicGalleryStates();

    if (
      publicGalleryProjects.length === 0
    ) {
      grid.innerHTML = "";

      if ($("publicGalleryEmpty")) {
        $("publicGalleryEmpty").hidden =
          false;
      }

      if (
        $("publicGalleryLoadMoreWrap")
      ) {
        $("publicGalleryLoadMoreWrap")
          .hidden = true;
      }

      return;
    }

    if (
      filteredGalleryProjects.length ===
      0
    ) {
      grid.innerHTML = "";

      if (
        $("publicGalleryNoResults")
      ) {
        $("publicGalleryNoResults")
          .hidden = false;
      }

      if (
        $("publicGalleryLoadMoreWrap")
      ) {
        $("publicGalleryLoadMoreWrap")
          .hidden = true;
      }

      return;
    }

    const visibleProjects =
      filteredGalleryProjects.slice(
        0,
        visibleProjectLimit
      );

    grid.innerHTML =
      visibleProjects
        .map(
          (
            project,
            index
          ) =>
            createPublicGalleryCard(
              project,
              index
            )
        )
        .join("");

    initialiseGalleryImages(grid);
    initialiseDynamicRevealItems(grid);

    if (
      $("publicGalleryLoadMoreWrap")
    ) {
      $("publicGalleryLoadMoreWrap")
        .hidden =
        visibleProjectLimit >=
        filteredGalleryProjects.length;
    }
  };


const createPublicGalleryCard = (
  project,
  index
) => {
  const category =
    getPublicGalleryCategory(
      project.category_id
    );

  const imageCount =
    getPublicGalleryImageCount(
      project.id
    );

  const cover =
    getPublicGalleryCover(project);

  const date =
    formatGalleryDate(
      project.project_date ||
      project.created_at
    );

  return `
    <article
      class="public-gallery-card gallery-reveal"
      style="animation-delay:${
        Math.min(index * 0.06, 0.48)
      }s;"
    >

      <div
        class="public-gallery-card-image gallery-image-loading"
        data-open-public-project="${escapeGalleryHTML(
          project.id
        )}"
        role="button"
        tabindex="0"
        aria-label="Open ${escapeGalleryHTML(
          project.title
        )}"
      >

        ${
          cover
            ? `
              <img
                src="${escapeGalleryHTML(cover)}"
                alt="${escapeGalleryHTML(
                  project.title
                )}"
                loading="lazy"
              >
            `
            : `
              <div class="public-gallery-card-placeholder">
                <i class="far fa-image"></i>
                <span>No cover image</span>
              </div>
            `
        }

        <span class="public-gallery-card-category">
          <i class="fas ${escapeGalleryHTML(
            category?.icon ||
            "fa-folder-open"
          )}"></i>

          ${escapeGalleryHTML(
            category?.name ||
            "Creative Project"
          )}
        </span>

        ${
          project.is_featured
            ? `
              <span
                class="public-gallery-card-featured"
                title="Featured project"
              >
                <i class="fas fa-star"></i>
              </span>
            `
            : ""
        }

        <span class="public-gallery-card-view">
          <i class="fas fa-eye"></i>
          View Project
        </span>

        <span class="public-gallery-card-count">
          <i class="fas fa-images"></i>

          ${imageCount}
        </span>

      </div>


      <div class="public-gallery-card-body">

        <h3>
          ${escapeGalleryHTML(
            project.title
          )}
        </h3>

        <p class="public-gallery-card-description">
          ${escapeGalleryHTML(
            project.description ||
            "Explore this creative project from HoblemercyTech."
          )}
        </p>

        <div class="public-gallery-card-meta">

          ${
            date
              ? `
                <span>
                  <i class="far fa-calendar"></i>
                  ${escapeGalleryHTML(date)}
                </span>
              `
              : ""
          }

          ${
            project.client_name
              ? `
                <span>
                  <i class="far fa-user"></i>
                  ${escapeGalleryHTML(
                    project.client_name
                  )}
                </span>
              `
              : ""
          }

        </div>

        <button
          type="button"
          class="public-gallery-card-open"
          data-open-public-project="${escapeGalleryHTML(
            project.id
          )}"
        >
          <i class="fas fa-images"></i>
          View Full Project
        </button>

      </div>

    </article>
  `;
};


/* ============================================================
   PROJECT MODAL
============================================================ */

const openPublicProjectModal =
  projectId => {
    const project =
      publicGalleryProjects.find(
        item =>
          String(item.id) ===
          String(projectId)
      );

    if (!project) {
      showGalleryToast(
        "The selected project could not be found.",
        "error"
      );

      return;
    }

    lastFocusedGalleryElement =
      document.activeElement;

    activeModalProject = project;

    const projectImages =
      getPublicGalleryProjectImages(
        project.id
      );

    const cover =
      getPublicGalleryCover(project);

    /*
      Ensure the cover is included if it has no
      matching gallery_images row.
    */

    activeModalImages = [
      ...projectImages
    ];

    const coverAlreadyIncluded =
      activeModalImages.some(
        image =>
          image.image_url === cover
      );

    if (
      cover &&
      !coverAlreadyIncluded
    ) {
      activeModalImages.unshift({
        id:
          `cover-${project.id}`,

        project_id:
          project.id,

        image_url:
          cover,

        alt_text:
          project.title,

        caption: null,
        display_order: -1,
        is_cover: true
      });
    }

    activeModalImageIndex = 0;

    const category =
      getPublicGalleryCategory(
        project.category_id
      );

    $("publicProjectModalCategory")
      .textContent =
      category?.name ||
      "Creative Project";

    $("publicProjectModalTitle")
      .textContent =
      project.title ||
      "Creative Project";

    $("publicProjectModalDescription")
      .textContent =
      project.description ||
      "Explore the complete collection of images from this project.";


    /* Client */

    if (project.client_name) {
      $("publicProjectModalClientWrap")
        .hidden = false;

      $("publicProjectModalClient")
        .textContent =
        project.client_name;

    } else {
      $("publicProjectModalClientWrap")
        .hidden = true;
    }


    /* Date */

    const projectDate =
      formatGalleryDate(
        project.project_date ||
        project.created_at
      );

    if (projectDate) {
      $("publicProjectModalDateWrap")
        .hidden = false;

      $("publicProjectModalDate")
        .textContent =
        projectDate;

    } else {
      $("publicProjectModalDateWrap")
        .hidden = true;
    }


    /* Image count */

    const count =
      activeModalImages.length;

    $("publicProjectModalImageCount")
      .textContent =
      `${count} ${
        count === 1
          ? "image"
          : "images"
      }`;

    $("publicProjectTotalImages")
      .textContent =
      String(count || 1);


    /* WhatsApp */

    $("publicProjectBookBtn").href =
      createProjectWhatsAppURL(
        project
      );


    renderPublicProjectThumbnails();

    if (count > 0) {
      showPublicProjectImage(0);
    } else {
      showEmptyProjectViewer(
        project
      );
    }

    const modal =
      $("publicProjectModal");

    modal.classList.add("open");

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.classList.add(
      "modal-open"
    );

    setTimeout(() => {
      $("closePublicProjectModalBtn")
        ?.focus();
    }, 80);
  };


const closePublicProjectModal =
  () => {
    const modal =
      $("publicProjectModal");

    modal.classList.remove("open");

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "modal-open"
    );

    activeModalProject = null;
    activeModalImages = [];
    activeModalImageIndex = 0;

    if (
      lastFocusedGalleryElement &&
      typeof
        lastFocusedGalleryElement.focus ===
        "function"
    ) {
      lastFocusedGalleryElement.focus();
    }

    lastFocusedGalleryElement = null;
  };


/* ============================================================
   MODAL IMAGE VIEWER
============================================================ */

const showPublicProjectImage =
  index => {
    if (
      !activeModalImages.length
    ) {
      return;
    }

    const normalizedIndex =
      (
        index +
        activeModalImages.length
      ) %
      activeModalImages.length;

    activeModalImageIndex =
      normalizedIndex;

    const image =
      activeModalImages[
        normalizedIndex
      ];

    const mainImage =
      $("publicProjectMainImage");

    const imageWrap =
      mainImage.closest(
        ".public-project-main-image-wrap"
      );

    imageWrap.classList.add(
      "is-changing"
    );

    window.setTimeout(() => {
      mainImage.src =
        image.image_url || "";

      mainImage.alt =
        image.alt_text ||
        activeModalProject?.title ||
        "Gallery project image";

      const caption =
        image.caption?.trim() || "";

      if (caption) {
        $("publicProjectImageCaption")
          .hidden = false;

        $("publicProjectImageCaption")
          .textContent = caption;

      } else {
        $("publicProjectImageCaption")
          .hidden = true;

        $("publicProjectImageCaption")
          .textContent = "";
      }

      $("publicProjectCurrentImage")
        .textContent =
        String(normalizedIndex + 1);

      updatePublicProjectThumbnailState();

      imageWrap.classList.remove(
        "is-changing"
      );

    }, 120);


    const disableNavigation =
      activeModalImages.length <= 1;

    $("publicProjectPreviousBtn")
      .disabled =
      disableNavigation;

    $("publicProjectNextBtn")
      .disabled =
      disableNavigation;
  };


const showEmptyProjectViewer =
  project => {
    const image =
      $("publicProjectMainImage");

    image.removeAttribute("src");

    image.alt =
      `${project.title} has no images`;

    $("publicProjectImageCaption")
      .hidden = false;

    $("publicProjectImageCaption")
      .textContent =
      "Images have not been added to this project.";

    $("publicProjectCurrentImage")
      .textContent = "0";

    $("publicProjectTotalImages")
      .textContent = "0";

    $("publicProjectPreviousBtn")
      .disabled = true;

    $("publicProjectNextBtn")
      .disabled = true;
  };


const showPreviousPublicProjectImage =
  () => {
    showPublicProjectImage(
      activeModalImageIndex - 1
    );
  };


const showNextPublicProjectImage =
  () => {
    showPublicProjectImage(
      activeModalImageIndex + 1
    );
  };


/* ============================================================
   THUMBNAILS
============================================================ */

const renderPublicProjectThumbnails =
  () => {
    const container =
      $("publicProjectThumbnails");

    if (!container) {
      return;
    }

    if (!activeModalImages.length) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML =
      activeModalImages
        .map(
          (image, index) => `
            <button
              type="button"
              class="public-project-thumbnail ${
                index === 0
                  ? "active"
                  : ""
              }"
              data-public-thumbnail-index="${index}"
              role="listitem"
              aria-label="View image ${
                index + 1
              }"
            >
              <img
                src="${escapeGalleryHTML(
                  image.image_url
                )}"
                alt="${escapeGalleryHTML(
                  image.alt_text ||
                  `Project image ${
                    index + 1
                  }`
                )}"
                loading="lazy"
              >
            </button>
          `
        )
        .join("");
  };


const updatePublicProjectThumbnailState =
  () => {
    document
      .querySelectorAll(
        ".public-project-thumbnail"
      )
      .forEach(
        (
          thumbnail,
          index
        ) => {
          const isActive =
            index ===
            activeModalImageIndex;

          thumbnail.classList.toggle(
            "active",
            isActive
          );

          thumbnail.setAttribute(
            "aria-current",
            isActive
              ? "true"
              : "false"
          );

          if (isActive) {
            thumbnail.scrollIntoView({
              behavior: "smooth",
              inline: "center",
              block: "nearest"
            });
          }
        }
      );
  };


/* ============================================================
   WHATSAPP PROJECT LINK
============================================================ */

const createProjectWhatsAppURL =
  project => {
    const message =
      `Hello HoblemercyTech, ` +
      `I saw your "${project.title}" project ` +
      `in the gallery and I would like something similar.`;

    return (
      "https://wa.me/2349064748799" +
      `?text=${encodeURIComponent(
        message
      )}`
    );
  };


/* ============================================================
   IMAGE LOADING EFFECT
============================================================ */

const initialiseGalleryImages =
  container => {
    container
      .querySelectorAll("img")
      .forEach(image => {
        const wrapper =
          image.closest(
            ".gallery-image-loading"
          );

        if (!wrapper) {
          return;
        }

        const markLoaded = () => {
          wrapper.classList.add(
            "image-loaded"
          );
        };

        if (image.complete) {
          markLoaded();
        } else {
          image.addEventListener(
            "load",
            markLoaded,
            {
              once: true
            }
          );

          image.addEventListener(
            "error",
            markLoaded,
            {
              once: true
            }
          );
        }
      });
  };


/* ============================================================
   TOAST
============================================================ */

const showGalleryToast = (
  message,
  type = "info"
) => {
  const container =
    $("galleryToastContainer");

  if (!container) {
    return;
  }

  const toast =
    document.createElement("div");

  toast.className =
    `gallery-toast ${type}`;

  const iconMap = {
    success: "fa-circle-check",
    error:
      "fa-circle-exclamation",
    warning:
      "fa-triangle-exclamation",
    info: "fa-circle-info"
  };

  toast.innerHTML = `
    <i class="fas ${
      iconMap[type] ||
      iconMap.info
    }"></i>

    <span>
      ${escapeGalleryHTML(message)}
    </span>
  `;

  container.appendChild(toast);

  const removeToast = () => {
    toast.classList.add(
      "removing"
    );

    setTimeout(() => {
      toast.remove();
    }, 300);
  };

  setTimeout(
    removeToast,
    4000
  );
};


/* ============================================================
   THEME
============================================================ */

const initialiseGalleryTheme = () => {
  const savedTheme =
    localStorage.getItem(
      "hoblemercy-theme"
    );

  const systemDark =
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

  const theme =
    savedTheme ||
    (systemDark
      ? "dark"
      : "light");

  applyGalleryTheme(theme);
};


const applyGalleryTheme = theme => {
  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  localStorage.setItem(
    "hoblemercy-theme",
    theme
  );

  const icon =
    $("themeIcon");

  const button =
    $("themeToggle");

  const isDark =
    theme === "dark";

  if (icon) {
    icon.className =
      isDark
        ? "fas fa-sun"
        : "fas fa-moon";
  }

  if (button) {
    button.setAttribute(
      "aria-pressed",
      String(isDark)
    );

    button.setAttribute(
      "aria-label",
      isDark
        ? "Switch to light mode"
        : "Switch to dark mode"
    );
  }

  const themeMeta =
    document.querySelector(
      'meta[name="theme-color"]'
    );

  if (themeMeta) {
    themeMeta.content =
      isDark
        ? "#0A0A0F"
        : "#F8FAFC";
  }
};


const toggleGalleryTheme = () => {
  const currentTheme =
    document.documentElement
      .getAttribute(
        "data-theme"
      ) || "light";

  applyGalleryTheme(
    currentTheme === "dark"
      ? "light"
      : "dark"
  );
};


/* ============================================================
   MOBILE MENU
============================================================ */

const toggleGalleryMobileMenu =
  () => {
    const nav =
      $("mainNav");

    const button =
      $("mobileMenuBtn");

    const icon =
      $("mobileMenuIcon");

    const isOpen =
      nav.classList.toggle("open");

    button.setAttribute(
      "aria-expanded",
      String(isOpen)
    );

    icon.className =
      isOpen
        ? "fas fa-xmark"
        : "fas fa-bars";
  };


const closeGalleryMobileMenu =
  () => {
    const nav =
      $("mainNav");

    const button =
      $("mobileMenuBtn");

    const icon =
      $("mobileMenuIcon");

    nav?.classList.remove("open");

    button?.setAttribute(
      "aria-expanded",
      "false"
    );

    if (icon) {
      icon.className =
        "fas fa-bars";
    }
  };


/* ============================================================
   HEADER AND BACK TO TOP
============================================================ */

let previousScrollPosition =
  window.scrollY;


const handleGalleryScroll = () => {
  const scrollPosition =
    window.scrollY;

  const header =
    $("siteHeader");

  const backToTop =
    $("backToTop");

  header?.classList.toggle(
    "scrolled",
    scrollPosition > 30
  );

  backToTop?.classList.toggle(
    "visible",
    scrollPosition > 500
  );

  /*
    Keep header visible on mobile.
    Hide slightly on desktop while scrolling down.
  */

  if (
    window.innerWidth > 1000 &&
    scrollPosition > 250
  ) {
    const scrollingDown =
      scrollPosition >
      previousScrollPosition;

    header?.classList.toggle(
      "header-hidden",
      scrollingDown
    );

  } else {
    header?.classList.remove(
      "header-hidden"
    );
  }

  previousScrollPosition =
    scrollPosition;
};


/* ============================================================
   SCROLL REVEAL
============================================================ */

let galleryRevealObserver = null;


const initialiseGalleryReveal = () => {
  galleryRevealObserver =
    new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (
            !entry.isIntersecting
          ) {
            return;
          }

          entry.target.classList.add(
            "revealed"
          );

          galleryRevealObserver
            .unobserve(
              entry.target
            );
        });
      },
      {
        threshold: 0.12,
        rootMargin:
          "0px 0px -40px 0px"
      }
    );

  initialiseDynamicRevealItems(
    document
  );
};


const initialiseDynamicRevealItems =
  container => {
    if (!galleryRevealObserver) {
      return;
    }

    container
      .querySelectorAll(
        ".gallery-reveal:not(.revealed)," +
        ".gallery-reveal-left:not(.revealed)," +
        ".gallery-reveal-right:not(.revealed)"
      )
      .forEach(element => {
        galleryRevealObserver.observe(
          element
        );
      });
  };


/* ============================================================
   HERO COUNTERS
============================================================ */

const initialiseGalleryCounters =
  () => {
    const counters =
      document.querySelectorAll(
        ".gallery-counter"
      );

    if (!counters.length) {
      return;
    }

    const observer =
      new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (
              !entry.isIntersecting
            ) {
              return;
            }

            animateGalleryCounter(
              entry.target
            );

            observer.unobserve(
              entry.target
            );
          });
        },
        {
          threshold: 0.35
        }
      );

    counters.forEach(counter => {
      observer.observe(counter);
    });
  };


const animateGalleryCounter =
  counter => {
    const target =
      Number(
        counter.dataset.target ||
        0
      );

    const suffix =
      counter.dataset.suffix || "";

    const duration = 1400;

    const start =
      performance.now();

    const update = time => {
      const progress =
        Math.min(
          (time - start) /
            duration,
          1
        );

      const eased =
        1 -
        Math.pow(
          1 - progress,
          3
        );

      counter.textContent =
        `${Math.round(
          target * eased
        )}${suffix}`;

      if (progress < 1) {
        requestAnimationFrame(
          update
        );
      }
    };

    requestAnimationFrame(update);
  };


/* ============================================================
   PREMIUM HERO PARALLAX
============================================================ */

const initialisePremiumGalleryHero =
  () => {
    const showcase =
      $("premiumGalleryShowcase");

    if (!showcase) {
      return;
    }

    const cards =
      showcase.querySelectorAll(
        ".premium-project-card," +
        ".premium-showcase-badge"
      );

    const finePointer =
      window.matchMedia(
        "(pointer: fine)"
      ).matches;

    const reducedMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (
      !finePointer ||
      reducedMotion
    ) {
      return;
    }

    showcase.addEventListener(
      "mousemove",
      event => {
        const bounds =
          showcase.getBoundingClientRect();

        const x =
          (
            event.clientX -
            bounds.left
          ) /
            bounds.width -
          0.5;

        const y =
          (
            event.clientY -
            bounds.top
          ) /
            bounds.height -
          0.5;

        cards.forEach(card => {
          const speed =
            Number(
              card.dataset
                .parallaxSpeed ||
              8
            );

          card.style.setProperty(
            "--parallax-x",
            `${x * speed}px`
          );

          card.style.setProperty(
            "--parallax-y",
            `${y * speed}px`
          );
        });
      }
    );

    showcase.addEventListener(
      "mouseleave",
      () => {
        cards.forEach(card => {
          card.style.setProperty(
            "--parallax-x",
            "0px"
          );

          card.style.setProperty(
            "--parallax-y",
            "0px"
          );
        });
      }
    );
  };


/* ============================================================
   EVENT BINDINGS
============================================================ */

const bindPublicGalleryEvents =
  () => {

    /* Theme */

    $("themeToggle")
      ?.addEventListener(
        "click",
        toggleGalleryTheme
      );


    /* Mobile menu */

    $("mobileMenuBtn")
      ?.addEventListener(
        "click",
        toggleGalleryMobileMenu
      );

    $("mainNav")
      ?.addEventListener(
        "click",
        event => {
          if (
            event.target.closest(
              ".nav-link"
            )
          ) {
            closeGalleryMobileMenu();
          }
        }
      );


    /* Search */

    $("publicGallerySearch")
      ?.addEventListener(
        "input",
        event => {
          publicGallerySearchTerm =
            event.target.value;

          visibleProjectLimit =
            PROJECTS_PER_PAGE;

          applyPublicGalleryFilters();
        }
      );


    /* Categories */

    $("publicGalleryFilters")
      ?.addEventListener(
        "click",
        event => {
          const button =
            event.target.closest(
              "[data-gallery-category]"
            );

          if (!button) {
            return;
          }

          activeGalleryCategory =
            button.dataset
              .galleryCategory;

          visibleProjectLimit =
            PROJECTS_PER_PAGE;

          document
            .querySelectorAll(
              "[data-gallery-category]"
            )
            .forEach(item => {
              const isActive =
                item === button;

              item.classList.toggle(
                "active",
                isActive
              );

              item.setAttribute(
                "aria-pressed",
                String(isActive)
              );
            });

          applyPublicGalleryFilters();
        }
      );


    /* Project cards and featured project */

    document.addEventListener(
      "click",
      event => {
        const projectButton =
          event.target.closest(
            "[data-open-public-project]"
          );

        if (!projectButton) {
          return;
        }

        openPublicProjectModal(
          projectButton.dataset
            .openPublicProject
        );
      }
    );


    /* Keyboard-open image cards */

    document.addEventListener(
      "keydown",
      event => {
        const projectCard =
          event.target.closest(
            ".public-gallery-card-image[data-open-public-project]"
          );

        if (
          projectCard &&
          (
            event.key === "Enter" ||
            event.key === " "
          )
        ) {
          event.preventDefault();

          openPublicProjectModal(
            projectCard.dataset
              .openPublicProject
          );
        }
      }
    );


    /* Load more */

    $("publicGalleryLoadMoreBtn")
      ?.addEventListener(
        "click",
        () => {
          visibleProjectLimit +=
            PROJECTS_PER_PAGE;

          renderPublicGalleryProjects();
        }
      );


    /* Reset filters */

    $("resetPublicGalleryFiltersBtn")
      ?.addEventListener(
        "click",
        () => {
          activeGalleryCategory =
            "all";

          publicGallerySearchTerm =
            "";

          visibleProjectLimit =
            PROJECTS_PER_PAGE;

          if (
            $("publicGallerySearch")
          ) {
            $("publicGallerySearch")
              .value = "";
          }

          document
            .querySelectorAll(
              "[data-gallery-category]"
            )
            .forEach(button => {
              const isAll =
                button.dataset
                  .galleryCategory ===
                "all";

              button.classList.toggle(
                "active",
                isAll
              );

              button.setAttribute(
                "aria-pressed",
                String(isAll)
              );
            });

          applyPublicGalleryFilters();
        }
      );


    /* Retry */

    $("retryPublicGalleryBtn")
      ?.addEventListener(
        "click",
        loadPublicGallery
      );


    /* Modal close */

    $("closePublicProjectModalBtn")
      ?.addEventListener(
        "click",
        closePublicProjectModal
      );

    $("publicProjectModalBackdrop")
      ?.addEventListener(
        "click",
        closePublicProjectModal
      );


    /* Modal navigation */

    $("publicProjectPreviousBtn")
      ?.addEventListener(
        "click",
        showPreviousPublicProjectImage
      );

    $("publicProjectNextBtn")
      ?.addEventListener(
        "click",
        showNextPublicProjectImage
      );


    /* Thumbnails */

    $("publicProjectThumbnails")
      ?.addEventListener(
        "click",
        event => {
          const thumbnail =
            event.target.closest(
              "[data-public-thumbnail-index]"
            );

          if (!thumbnail) {
            return;
          }

          showPublicProjectImage(
            Number(
              thumbnail.dataset
                .publicThumbnailIndex
            )
          );
        }
      );


    /* Keyboard modal controls */

    document.addEventListener(
      "keydown",
      event => {
        const modalOpen =
          $("publicProjectModal")
            ?.classList.contains(
              "open"
            );

        if (!modalOpen) {
          return;
        }

        if (event.key === "Escape") {
          closePublicProjectModal();
        }

        if (
          event.key ===
          "ArrowLeft"
        ) {
          showPreviousPublicProjectImage();
        }

        if (
          event.key ===
          "ArrowRight"
        ) {
          showNextPublicProjectImage();
        }
      }
    );


    /* Back to top */

    $("backToTop")
      ?.addEventListener(
        "click",
        () => {
          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });
        }
      );


    /* Scroll */

    window.addEventListener(
      "scroll",
      handleGalleryScroll,
      {
        passive: true
      }
    );


    /* Resize */

    window.addEventListener(
      "resize",
      () => {
        if (
          window.innerWidth >
          1000
        ) {
          closeGalleryMobileMenu();
        }
      }
    );
  };


/* ============================================================
   PAGE START
============================================================ */

const initialisePublicGalleryPage =
  async () => {
    initialiseGalleryTheme();
    bindPublicGalleryEvents();
    initialiseGalleryReveal();
    initialiseGalleryCounters();
    initialisePremiumGalleryHero();

    if ($("galleryCurrentYear")) {
      $("galleryCurrentYear")
        .textContent =
        new Date().getFullYear();
    }

    handleGalleryScroll();

    await loadPublicGallery();
  };


document.addEventListener(
  "DOMContentLoaded",
  initialisePublicGalleryPage
);