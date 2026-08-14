# Neptune Accessibility Launch Checklist

Neptune's CI includes an automated accessibility baseline against the production-rendered public pages. The baseline checks document language, page titles, one primary heading, image alt attributes, button naming, form-control labeling, and successful rendering.

This automated baseline is not a WCAG conformance certification. Before making any WCAG 2.2 AA claim, complete a manual review with assistive technology and remediate the results.

## Required manual release-candidate checks

- Keyboard-only navigation through public pages, login, dashboard, Security Center, Passkeys, No Other Master, and Emergency GPS.
- Visible focus indication on all actionable controls.
- Logical focus order after opening and closing menus/modals.
- Screen-reader names, roles, values, and error announcements.
- Heading hierarchy and landmark navigation.
- Form instructions and error recovery without color-only meaning.
- 200% and 400% text zoom without lost content or controls.
- Touch targets appropriate for vessel tablets and mobile devices.
- Color contrast review for normal text, large text, controls, status pills, and charts.
- Reduced-motion behavior for nonessential effects.
- High-contrast/forced-colors review where supported.
- Emergency GPS and distress controls usable without precision gestures.
- Offline and synchronization warnings understandable without relying only on color.
- Authentication flows usable with password managers, passkeys, and authenticator codes.

## Evidence to retain

For each release candidate, record:

- commit SHA;
- CI accessibility result;
- browser/OS/device tested;
- screen reader and version;
- keyboard review result;
- zoom/contrast result;
- defects found;
- remediation commit;
- reviewer and date.

Do not represent Neptune as conforming to WCAG 2.2 AA until the applicable product surfaces have been assessed against the full standard and material failures have been remediated.
