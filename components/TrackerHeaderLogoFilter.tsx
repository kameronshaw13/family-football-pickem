/** A 0.7px image-alpha dilation gives logos a crisp, hairline-white
 * edge on both pale and colored backgrounds without a fuzzy shadow halo.
 * Keep the original ESPN image colors completely unchanged. */
export default function TrackerHeaderLogoFilter() {
  return <svg className="tracker-header-outline-filter-def" width="0" height="0" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="tracker-crisp-white-logo-outline" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="0.7" result="outline-alpha" />
        <feFlood floodColor="#ffffff" result="white" />
        <feComposite in="white" in2="outline-alpha" operator="in" result="border" />
        <feMerge><feMergeNode in="border" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  </svg>;
}
