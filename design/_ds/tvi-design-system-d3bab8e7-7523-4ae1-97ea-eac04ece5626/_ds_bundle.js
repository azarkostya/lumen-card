/* @ds-bundle: {"format":3,"namespace":"TVIDesignSystem_d3bab8","components":[{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"NavLink","sourcePath":"components/core/NavLink.jsx"},{"name":"SectionHeading","sourcePath":"components/core/SectionHeading.jsx"},{"name":"TestimonialCard","sourcePath":"components/feedback/TestimonialCard.jsx"},{"name":"TgButton","sourcePath":"components/feedback/TgButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"GlassPanel","sourcePath":"components/surfaces/GlassPanel.jsx"},{"name":"GlowField","sourcePath":"components/surfaces/GlowField.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"65d469e97ab3","components/core/Badge.jsx":"31b883e1632b","components/core/Button.jsx":"a5f0de52cd0c","components/core/NavLink.jsx":"9e42c7180b33","components/core/SectionHeading.jsx":"2996c5247c29","components/feedback/TestimonialCard.jsx":"db4e652344f9","components/feedback/TgButton.jsx":"4ff4962773b6","components/forms/Input.jsx":"15a2cef7b872","components/forms/Select.jsx":"c66e28e895ea","components/surfaces/Card.jsx":"a5829adcbe56","components/surfaces/GlassPanel.jsx":"72453e90626c","components/surfaces/GlowField.jsx":"2ae021a11572"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TVIDesignSystem_d3bab8 = window.TVIDesignSystem_d3bab8 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Logo — the TVI (ТВИ) monogram wordmark, drawn as inline vector paths so it can
 * be recolored and sized freely. Default is the 56%-opacity white used in the
 * glass nav; pass color / opacity for footer (full white) or light contexts.
 */
function Logo({
  height = 12,
  color = "#ffffff",
  opacity = 0.5625,
  style,
  ...rest
}) {
  const width = height * 34 / 12;
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: width,
    height: height,
    viewBox: "0 0 34 12",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    role: "img",
    "aria-label": "TVI",
    style: {
      display: "block",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("g", {
    fill: color,
    fillOpacity: opacity
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 2.5267H3.60599L1.78914 11.1988H4.66331L6.48016 2.5267H10.0861L10.6148 0.00112723H0.528663L0 2.5267Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17.8766 5.92379C17.9262 5.68832 17.9482 5.58212 18.0128 5.27508C19.5711 5.18274 20.2637 4.05154 20.5142 2.85455C20.9759 0.653325 19.234 0 16.1902 0H11.2349L8.88935 11.1977H13.8447C16.0147 11.1977 19.2167 11.252 19.8285 8.32932C20.2013 6.37512 19.3853 6.01382 17.8766 5.92264V5.92379ZM13.6727 2.22777H16.099C16.7189 2.22777 17.1159 2.72988 16.9867 3.35089C16.8574 3.97189 16.2491 4.47401 15.6292 4.47401H13.2029L13.6739 2.22892L13.6727 2.22777ZM15.0325 8.97226H12.2599L12.7308 6.72717H15.5034C16.1232 6.72717 16.5203 7.22929 16.391 7.85029C16.2606 8.47014 15.6535 8.97341 15.0336 8.97341L15.0325 8.97226Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M28.0054 0.00112723L23.1551 10.1023H22.5065L23.2887 8.37085L25.0575 0.00112723H22.1936L21.5957 2.85567C21.2171 4.81219 21.9096 5.18387 23.4287 5.27621C23.3894 5.4609 23.356 5.62365 23.2925 5.92492C21.7469 6.01611 20.8939 6.3774 20.4483 8.3316L19.8469 11.2H25.5787L29.2339 3.58128L30.421 1.10578H31.0719C30.8184 1.61842 30.2084 2.84546 30.2084 2.84546L29.315 7.02033L28.4545 11.2H31.3298L33.6764 0.00112723H28.0054Z"
  })));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Badge — a small label chip. Used for country/market pills, tags and statuses.
 *
 * Variants:
 *  - "outline"  thin lavender ring, transparent fill (the country-page pills).
 *  - "solid"    filled with the current action color.
 *  - "soft"     faint translucent fill, used as a tag.
 *  - "dot"      includes a leading status dot.
 */
function Badge({
  children,
  variant = "outline",
  dot = false,
  style,
  ...rest
}) {
  const variants = {
    outline: {
      border: "1px solid rgba(217,223,255,0.4)",
      color: "var(--color-text-tg)",
      background: "transparent"
    },
    solid: {
      border: "1px solid transparent",
      color: "#fff",
      background: "var(--color-action-primary)"
    },
    soft: {
      border: "1px solid var(--color-border-card)",
      color: "var(--color-text-subtitle)",
      background: "rgba(255,255,255,0.03)"
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 14px",
      borderRadius: "var(--radius-60)",
      fontFamily: "var(--font-family-primary)",
      fontWeight: 500,
      fontSize: 13,
      lineHeight: 1.2,
      ...variants[variant],
      ...style
    }
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: variant === "solid" ? "#fff" : "var(--color-action-primary)",
      boxShadow: "0 0 6px var(--color-action-primary)"
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Button — TVI's primary action control.
 *
 * Variants:
 *  - "primary"  solid electric-blue (#24389a), 14px radius. The workhorse CTA.
 *  - "glass"    translucent white-on-dark pill used in the glass nav bar.
 *  - "pill"     full-radius "book a meeting" pill with the lavender gradient fill
 *               and a 1px gradient ring.
 *  - "submit"   full-width form submit (SemiBold 18, tracked), white glow on hover.
 *  - "ghost"    text-only with a faint hover wash.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  icon,
  iconRight,
  fullWidth = false,
  disabled = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const pad = size === "sm" ? "7px 20px 8px" : size === "lg" ? "16px 40px" : "11px 28px";
  const fs = size === "sm" ? 12 : size === "lg" ? 18 : 15;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-10)",
    fontFamily: "var(--font-family-primary)",
    fontWeight: 500,
    fontSize: fs,
    lineHeight: 1.2,
    textDecoration: "none",
    border: "1px solid transparent",
    borderRadius: "var(--radius-14)",
    padding: pad,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    width: fullWidth ? "100%" : "auto",
    boxSizing: "border-box",
    transition: "background-color 150ms var(--ease-out), border-color 150ms var(--ease-out), box-shadow 150ms var(--ease-out), color 150ms var(--ease-out)",
    whiteSpace: "nowrap"
  };
  const variants = {
    primary: {
      background: hover ? "var(--color-action-hover)" : "var(--color-action-primary)",
      color: "#fff",
      boxShadow: hover ? "var(--shadow-action)" : "none"
    },
    glass: {
      background: hover ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
      borderColor: hover ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.08)",
      color: hover ? "#fff" : "rgba(255,255,255,0.75)",
      boxShadow: hover ? "var(--shadow-glow-white)" : "none"
    },
    pill: {
      backgroundImage: "var(--gradient-pill)",
      color: "#0b0c17",
      borderRadius: "var(--radius-60)",
      fontWeight: 600
    },
    submit: {
      background: "var(--color-action-primary)",
      color: "#fff",
      fontWeight: 600,
      fontSize: 18,
      letterSpacing: "var(--tracking-submit)",
      borderRadius: "var(--radius-14)",
      padding: size === "sm" ? "12px 24px" : "16px 40px",
      boxShadow: hover ? "var(--shadow-glow-white-lg)" : "none",
      borderColor: hover ? "rgba(216,222,254,0.4)" : "transparent"
    },
    ghost: {
      background: hover ? "rgba(255,255,255,0.05)" : "transparent",
      color: hover ? "#fff" : "rgba(255,255,255,0.7)"
    }
  };
  const composed = {
    ...base,
    ...variants[variant],
    ...style
  };
  const Tag = href && !disabled ? "a" : "button";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href && !disabled ? href : undefined,
    onClick: disabled ? undefined : onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: composed,
    disabled: Tag === "button" ? disabled : undefined
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-flex"
    }
  }, icon), children, iconRight && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-flex"
    }
  }, iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/NavLink.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * NavLink — a header navigation pill. Default state is a low-opacity white label
 * on transparent; on hover the pill fills with a faint white wash and the label
 * brightens. Matches the glass-nav links 1:1.
 */
function NavLink({
  children,
  href = "#",
  active = false,
  hasDropdown = false,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const on = hover || active;
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: "var(--radius-30)",
      fontFamily: "var(--font-family-primary)",
      fontWeight: 500,
      fontSize: 14,
      lineHeight: "16.8px",
      textDecoration: "none",
      color: on ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5625)",
      background: on ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0)",
      transition: "background-color 200ms var(--ease-out), color 200ms var(--ease-out)",
      ...style
    }
  }, rest), children, hasDropdown && /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "6",
    viewBox: "0 0 10 6",
    fill: "none",
    "aria-hidden": "true",
    style: {
      opacity: 0.7,
      transform: on ? "rotate(180deg)" : "none",
      transition: "transform 200ms var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l4 4 4-4",
    stroke: "currentColor",
    strokeWidth: "1.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })));
}
Object.assign(__ds_scope, { NavLink });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/NavLink.jsx", error: String((e && e.message) || e) }); }

// components/core/SectionHeading.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SectionHeading — the brand's gradient display heading. Cool top-down fill
 * (lavender → slate). Raleway Bold 50/50 desktop, fluid down to 27px on mobile.
 *
 * Use `as` to control the tag (h1/h2/h3). `tone="bright"` includes a pure-white
 * top stop for hero H1s; default omits it for calmer section H2s.
 */
function SectionHeading({
  children,
  as = "h2",
  tone = "section",
  align = "left",
  style,
  ...rest
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      margin: 0,
      fontFamily: "var(--font-family-primary)",
      fontWeight: 700,
      fontSize: "clamp(27px, 4.5vw, 50px)",
      lineHeight: 1.05,
      letterSpacing: "-0.01em",
      textAlign: align,
      width: "fit-content",
      marginLeft: align === "center" ? "auto" : undefined,
      marginRight: align === "center" ? "auto" : undefined,
      backgroundImage: tone === "bright" ? "var(--gradient-heading)" : "var(--gradient-section)",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
      textWrap: "balance",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { SectionHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SectionHeading.jsx", error: String((e && e.message) || e) }); }

// components/feedback/TestimonialCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * TestimonialCard — a client review. Brand logo on top, industry caption, quote
 * body (may contain line breaks via the `quote` string with \n), then the
 * reviewer's name and position. Sits on the dark page (borderless by default).
 */
function TestimonialCard({
  logo,
  logoAlt = "",
  logoHeight = 30,
  industry,
  quote,
  name,
  position,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("figure", _extends({
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-24)",
      margin: 0,
      maxWidth: 320,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 40,
      display: "flex",
      alignItems: "center"
    }
  }, logo ? /*#__PURE__*/React.createElement("img", {
    src: logo,
    alt: logoAlt,
    style: {
      height: logoHeight,
      width: "auto",
      display: "block",
      filter: "brightness(0) invert(1)"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h3)",
      color: "#fff"
    }
  }, logoAlt)), industry && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-name)",
      color: "var(--color-text-caption)"
    }
  }, industry), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      font: "var(--type-testimonial)",
      color: "var(--color-text-subtitle)",
      whiteSpace: "pre-line"
    }
  }, quote), /*#__PURE__*/React.createElement("figcaption", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-name)",
      color: "var(--color-text-primary)"
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-position)",
      color: "var(--color-text-caption)"
    }
  }, position)));
}
Object.assign(__ds_scope, { TestimonialCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/TestimonialCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/TgButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * TgButton — the Telegram subscribe / contact button. Solid action-blue, 14px
 * radius, with an animated paper-plane that lifts up-and-right on hover. Used in
 * the Telegram banner and contact rows.
 */
function TgButton({
  children = "Подписаться",
  href = "#",
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  return /*#__PURE__*/React.createElement("a", _extends({
    href: href,
    target: "_blank",
    rel: "noopener",
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-14)",
      padding: "13px 28px",
      borderRadius: "var(--radius-14)",
      background: "var(--color-action-primary)",
      color: "#fff",
      textDecoration: "none",
      fontFamily: "var(--font-family-primary)",
      fontWeight: 500,
      fontSize: 15,
      lineHeight: "18px",
      border: "1px solid transparent",
      boxShadow: hover ? "var(--shadow-glow-white)" : "none",
      borderColor: hover ? "rgba(216,222,254,0.4)" : "transparent",
      transition: "box-shadow 200ms var(--ease-out), border-color 200ms var(--ease-out)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", null, children), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      display: "inline-flex",
      transform: hover ? "translate(3px, -3px)" : "none",
      transition: "transform 200ms var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "16",
    viewBox: "0 0 18 16",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M17.4 0.6 0.9 7.1c-.7.3-.7 1.3 0 1.5l4 1.3 1.6 4.7c.2.6 1 .7 1.4.2l2.2-2.6 4.1 3c.5.4 1.2.1 1.4-.5L17.99 1.4c.2-.7-.5-1.1-1.1-.8Z",
    fill: "#fff"
  }))));
}
Object.assign(__ds_scope, { TgButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/TgButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Input — TVI text field. Two variants:
 *  - "underline"  the CTA-form style: no box, just a 0.8px bottom border in
 *    form-slate; placeholder doubles as the label. The default.
 *  - "bordered"   a full 1px outlined field on a faint translucent fill.
 *
 * Focus brightens the border toward the action color.
 */
function Input({
  variant = "underline",
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  style,
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const shared = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "var(--font-family-primary)",
    fontWeight: 500,
    fontSize: 15,
    lineHeight: "18px",
    color: "var(--color-text-primary)",
    background: "transparent",
    outline: "none"
  };
  const underline = {
    ...shared,
    border: "none",
    borderBottom: `0.8px solid ${focus ? "var(--color-text-tg)" : "var(--color-border-form)"}`,
    borderRadius: 0,
    padding: "0 0 12px",
    transition: "border-color 150ms var(--ease-out)"
  };
  const bordered = {
    ...shared,
    border: `1px solid ${focus ? "var(--color-action-primary)" : "var(--color-border-form)"}`,
    borderRadius: "var(--radius-14)",
    padding: "14px 18px",
    background: "rgba(255,255,255,0.02)",
    transition: "border-color 150ms var(--ease-out)"
  };
  const field = /*#__PURE__*/React.createElement("input", _extends({
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder ?? label,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      ...(variant === "bordered" ? bordered : underline),
      ...style
    }
  }, rest));
  if (variant === "bordered" && label) {
    return /*#__PURE__*/React.createElement("label", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--type-subtitle)",
        color: "var(--color-text-tg)",
        fontWeight: 600
      }
    }, label), field);
  }
  return field;
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Select — the budget-style dropdown from the CTA form. Underline trigger that
 * matches Input, with a glass popup of options. Self-contained (manages its own
 * open state + selection); pass `options` and an optional `onSelect`.
 */
function Select({
  label = "Выберите",
  options = [],
  value,
  onSelect,
  variant = "underline",
  style,
  ...rest
}) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(value ?? null);
  const current = sel ?? value;
  const choose = opt => {
    setSel(opt);
    setOpen(false);
    onSelect && onSelect(opt);
  };
  const trigger = {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontFamily: "var(--font-family-primary)",
    fontWeight: 500,
    fontSize: 15,
    lineHeight: "18px",
    color: current ? "var(--color-text-primary)" : "rgba(255,255,255,0.6)",
    background: variant === "bordered" ? "rgba(255,255,255,0.02)" : "transparent",
    border: variant === "bordered" ? "1px solid var(--color-border-form)" : "none",
    borderBottom: variant === "bordered" ? "1px solid var(--color-border-form)" : `0.8px solid ${open ? "var(--color-text-tg)" : "var(--color-border-form)"}`,
    borderRadius: variant === "bordered" ? "var(--radius-14)" : 0,
    padding: variant === "bordered" ? "14px 18px" : "0 0 12px",
    cursor: "pointer",
    textAlign: "left"
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: trigger,
    onClick: () => setOpen(o => !o),
    "aria-haspopup": "listbox",
    "aria-expanded": open
  }, /*#__PURE__*/React.createElement("span", null, current ?? label), /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "7",
    viewBox: "0 0 12 7",
    fill: "none",
    "aria-hidden": "true",
    style: {
      flex: "0 0 auto",
      transform: open ? "rotate(180deg)" : "none",
      transition: "transform 150ms var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l5 5 5-5",
    stroke: "var(--color-decoration-arrow)",
    strokeWidth: "1.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), open && /*#__PURE__*/React.createElement("ul", {
    role: "listbox",
    style: {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: 0,
      right: 0,
      margin: 0,
      padding: 6,
      listStyle: "none",
      zIndex: 20,
      borderRadius: "var(--radius-14)",
      border: "1px solid rgba(39,39,39,0.6)",
      background: "rgba(13,13,13,0.92)",
      backdropFilter: "blur(var(--blur-card))",
      WebkitBackdropFilter: "blur(var(--blur-card))",
      boxShadow: "0 16px 48px rgba(2,5,20,0.6)"
    }
  }, options.map(opt => /*#__PURE__*/React.createElement("li", {
    key: opt,
    role: "option",
    "aria-selected": current === opt
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => choose(opt),
    style: {
      width: "100%",
      textAlign: "left",
      padding: "10px 12px",
      borderRadius: "var(--radius-8)",
      border: "none",
      background: current === opt ? "rgba(255,255,255,0.06)" : "transparent",
      color: "var(--color-text-subtitle)",
      fontFamily: "var(--font-family-primary)",
      fontWeight: 500,
      fontSize: 14,
      cursor: "pointer"
    },
    onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.06)",
    onMouseLeave: e => e.currentTarget.style.background = current === opt ? "rgba(255,255,255,0.06)" : "transparent"
  }, opt)))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
/**
 * Card — the portfolio / case card. A dark gradient surface with a thin border
 * and heavy backdrop-blur, an image area on top (rounded only at the top), and a
 * text block (UPPERCASE title + muted excerpt). On hover the surface and border
 * brighten — no transform, matching the design source.
 */
function Card({
  image,
  imageAlt = "",
  title,
  excerpt,
  href,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const Tag = href ? "a" : "article";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    href: href,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-16)",
      paddingBottom: "var(--space-20)",
      textDecoration: "none",
      background: hover ? "var(--gradient-card-hover)" : "var(--gradient-card)",
      backdropFilter: "blur(var(--blur-card))",
      WebkitBackdropFilter: "blur(var(--blur-card))",
      border: "1.2px solid",
      borderColor: hover ? "var(--color-border-card-hover)" : "var(--color-border-card)",
      borderRadius: "var(--radius-14)",
      overflow: "hidden",
      boxSizing: "border-box",
      transition: "background 200ms var(--ease-inout), border-color 200ms var(--ease-inout)",
      ...style
    }
  }, rest), image && /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      aspectRatio: "302 / 261",
      overflow: "hidden",
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: imageAlt,
    loading: "lazy",
    decoding: "async",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      borderRadius: "10px 10px 0 0",
      display: "block"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)",
      padding: "0 var(--space-10)"
    }
  }, title && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body)",
      color: "var(--color-text-primary)",
      textTransform: "uppercase"
    }
  }, title), excerpt && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-caption)",
      color: "var(--color-text-caption)"
    }
  }, excerpt), children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/GlassPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * GlassPanel — the frosted-glass container used for the nav bar, dropdowns and
 * floating overlays. Translucent radial-white fill, heavy backdrop-blur, and a
 * faint 1px white ring (drawn with the mask-composite technique so it respects
 * the border radius).
 */
function GlassPanel({
  children,
  radius = 24,
  blur = "var(--blur-glass)",
  padding = "var(--space-20)",
  style = {},
  ...rest
}) {
  // Layout props (flex/grid) are forwarded to the INNER content wrapper so they
  // actually govern the children. Box-level props (size, background override)
  // stay on the outer panel. The ring is absolute and out of flow either way.
  const {
    display,
    flexDirection,
    alignItems,
    justifyContent,
    gap,
    flexWrap,
    gridTemplateColumns,
    gridTemplateAreas,
    gridAutoFlow,
    ...box
  } = style;
  const layout = {
    display,
    flexDirection,
    alignItems,
    justifyContent,
    gap,
    flexWrap,
    gridTemplateColumns,
    gridTemplateAreas,
    gridAutoFlow
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      background: "var(--gradient-glass)",
      backdropFilter: `blur(${blur})`,
      WebkitBackdropFilter: `blur(${blur})`,
      borderRadius: radius,
      padding,
      boxSizing: "border-box",
      ...box
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      content: '""',
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      padding: 1,
      background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)",
      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
      WebkitMaskComposite: "xor",
      maskComposite: "exclude",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      height: "100%",
      ...layout
    }
  }, children));
}
Object.assign(__ds_scope, { GlassPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/GlassPanel.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/GlowField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * GlowField — TVI's signature ambient decoration: large, soft, blurred radial
 * blobs that sit behind hero and CTA sections. Recolors with the active theme
 * (blue by default, ice-blue under [data-theme="blue"], mint under "green").
 *
 * Purely decorative (aria-hidden). Place as the first child of a
 * position:relative container; it fills the container and sits behind content.
 */
function GlowField({
  intensity = 0.7,
  animate = true,
  style,
  ...rest
}) {
  const blob = cfg => ({
    position: "absolute",
    borderRadius: "50%",
    background: `radial-gradient(circle, var(--color-glow-core) 0%, var(--color-glow-falloff) 45%, transparent 72%)`,
    filter: `blur(${cfg.blur})`,
    opacity: cfg.op * intensity,
    pointerEvents: "none",
    ...cfg.pos
  });
  return /*#__PURE__*/React.createElement("div", _extends({
    "aria-hidden": "true",
    className: animate ? "tvi-pulse-slow" : undefined,
    style: {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: blob({
      blur: "var(--blur-glow-lg)",
      op: 0.85,
      pos: {
        width: "46%",
        height: "120%",
        left: "8%",
        top: "-30%"
      }
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: blob({
      blur: "var(--blur-glow-xl)",
      op: 0.6,
      pos: {
        width: "40%",
        height: "110%",
        right: "4%",
        top: "-20%"
      }
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: blob({
      blur: "var(--blur-glow-md)",
      op: 0.5,
      pos: {
        width: "55%",
        height: "80%",
        left: "25%",
        top: "10%"
      }
    })
  }));
}
Object.assign(__ds_scope, { GlowField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/GlowField.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.NavLink = __ds_scope.NavLink;

__ds_ns.SectionHeading = __ds_scope.SectionHeading;

__ds_ns.TestimonialCard = __ds_scope.TestimonialCard;

__ds_ns.TgButton = __ds_scope.TgButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.GlassPanel = __ds_scope.GlassPanel;

__ds_ns.GlowField = __ds_scope.GlowField;

})();
