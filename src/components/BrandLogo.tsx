import React from "react";

export type BrandLogoVariant =
  | "symbol"
  | "symbol-gold"
  | "symbol-white"
  | "symbol-dark"
  | "horizontal"
  | "horizontal-white"
  | "badge"
  | "wordmark";

export interface BrandLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: BrandLogoVariant;
  size?: number | string;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

/**
 * Teafloww Brand Vector Master Logo Component
 * Precision vector reproduction of the Himalayan sunrise, tea terraces, and leaf emblem.
 * Compliant with WCAG 2.2 AA and modern web performance best practices.
 */
export function BrandLogo({
  variant = "symbol",
  size,
  width,
  height,
  className = "",
  "aria-label": ariaLabel = "Teafloww",
  "aria-hidden": ariaHidden,
  style,
  ...props
}: BrandLogoProps) {
  const isDecorative = ariaHidden === true || ariaHidden === "true";

  // Shared accessibility props
  const a11yProps = isDecorative
    ? { "aria-hidden": true as const }
    : {
        role: "img" as const,
        "aria-label": ariaLabel,
      };

  // 1. SYMBOL ONLY (FULL COLOR) — Default Brand Emblem
  if (variant === "symbol") {
    const w = width ?? size ?? 36;
    const h = height ?? size ?? 35;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 370 360"
        width={w}
        height={h}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        {...a11yProps}
        {...props}
      >
        {!isDecorative && <title>{ariaLabel}</title>}
        <g transform="translate(58 47)">
          <path
            d="M16 125 C16 65 65 14 125 14 C169 14 209 39 225 77 C209 76 188 86 169 106 C139 118 76 125 16 125 Z"
            fill="#F3CAA6"
          />
          <path
            d="M47 129 C62 110 76 103 92 104 C108 80 125 69 141 72 C165 74 178 94 190 125 C138 140 86 144 47 129 Z"
            fill="#EBB77A"
          />
          <path
            d="M13 138 C53 123 87 126 129 146 C175 168 210 185 254 166 L246 183 C211 200 175 183 123 160 C78 142 48 135 15 151 Z"
            fill="#527F58"
          />
          <path
            d="M16 157 C53 146 86 151 130 171 C181 194 215 201 250 184 L241 199 C210 216 170 200 120 180 C75 163 46 157 20 171 Z"
            fill="#064C36"
          />
          <path
            d="M20 177 C53 170 86 178 127 197 C169 218 208 225 241 204 C230 220 210 234 189 239 C163 237 136 222 116 211 C75 190 48 183 25 188 Z"
            fill="#063B2F"
          />
          <path
            d="M29 195 C64 191 88 204 119 225 C132 233 145 238 160 243 C100 255 54 236 29 195 Z"
            fill="#063B2F"
          />
          <path
            d="M142 151 C154 116 167 80 202 55 C219 43 238 33 252 18 C250 54 243 87 220 113 C198 140 169 148 142 151 Z"
            fill="#063B2F"
          />
          <path
            d="M151 161 C176 140 202 136 222 111 C237 95 244 89 249 80 C258 111 254 140 242 153 C220 174 182 175 151 161 Z"
            fill="#063B2F"
          />
          <path
            d="M186 180 C207 169 231 167 246 157 C245 171 236 186 227 191 C213 190 201 187 186 180 Z"
            fill="#064C36"
          />
          <path
            d="M155 140 C178 97 209 73 238 47"
            fill="none"
            stroke="#527959"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M54 119 C72 108 79 107 94 108 C111 86 122 78 139 76 C154 77 164 88 174 101"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  // 2. SYMBOL GOLD FOIL — Luxury / Dark Surfaces (Admin, Accents)
  if (variant === "symbol-gold") {
    const w = width ?? size ?? 32;
    const h = height ?? size ?? 31;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 370 360"
        width={w}
        height={h}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        {...a11yProps}
        {...props}
      >
        {!isDecorative && <title>{ariaLabel}</title>}
        <g transform="translate(58 47)" fill="#D6B26C">
          <path d="M16 125 C16 65 65 14 125 14 C169 14 209 39 225 77 C209 76 188 86 169 106 C139 118 76 125 16 125 Z" />
          <path d="M47 129 C62 110 76 103 92 104 C108 80 125 69 141 72 C165 74 178 94 190 125 C138 140 86 144 47 129 Z" />
          <path d="M13 138 C53 123 87 126 129 146 C175 168 210 185 254 166 L246 183 C211 200 175 183 123 160 C78 142 48 135 15 151 Z" />
          <path d="M16 157 C53 146 86 151 130 171 C181 194 215 201 250 184 L241 199 C210 216 170 200 120 180 C75 163 46 157 20 171 Z" />
          <path d="M20 177 C53 170 86 178 127 197 C169 218 208 225 241 204 C230 220 210 234 189 239 C163 237 136 222 116 211 C75 190 48 183 25 188 Z" />
          <path d="M29 195 C64 191 88 204 119 225 C132 233 145 238 160 243 C100 255 54 236 29 195 Z" />
          <path d="M142 151 C154 116 167 80 202 55 C219 43 238 33 252 18 C250 54 243 87 220 113 C198 140 169 148 142 151 Z" />
          <path d="M151 161 C176 140 202 136 222 111 C237 95 244 89 249 80 C258 111 254 140 242 153 C220 174 182 175 151 161 Z" />
          <path d="M186 180 C207 169 231 167 246 157 C245 171 236 186 227 191 C213 190 201 187 186 180 Z" />
          <path
            d="M155 140 C178 97 209 73 238 47"
            fill="none"
            stroke="#D6B26C"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      </svg>
    );
  }

  // 3. SYMBOL WHITE REVERSE — Contrast on Deep Forest Green
  if (variant === "symbol-white") {
    const w = width ?? size ?? 32;
    const h = height ?? size ?? 31;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 370 360"
        width={w}
        height={h}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        {...a11yProps}
        {...props}
      >
        {!isDecorative && <title>{ariaLabel}</title>}
        <g transform="translate(58 47)" fill="#FFFFFF">
          <path d="M16 125 C16 65 65 14 125 14 C169 14 209 39 225 77 C209 76 188 86 169 106 C139 118 76 125 16 125 Z" />
          <path d="M47 129 C62 110 76 103 92 104 C108 80 125 69 141 72 C165 74 178 94 190 125 C138 140 86 144 47 129 Z" />
          <path d="M13 138 C53 123 87 126 129 146 C175 168 210 185 254 166 L246 183 C211 200 175 183 123 160 C78 142 48 135 15 151 Z" />
          <path d="M16 157 C53 146 86 151 130 171 C181 194 215 201 250 184 L241 199 C210 216 170 200 120 180 C75 163 46 157 20 171 Z" />
          <path d="M20 177 C53 170 86 178 127 197 C169 218 208 225 241 204 C230 220 210 234 189 239 C163 237 136 222 116 211 C75 190 48 183 25 188 Z" />
          <path d="M29 195 C64 191 88 204 119 225 C132 233 145 238 160 243 C100 255 54 236 29 195 Z" />
          <path d="M142 151 C154 116 167 80 202 55 C219 43 238 33 252 18 C250 54 243 87 220 113 C198 140 169 148 142 151 Z" />
          <path d="M151 161 C176 140 202 136 222 111 C237 95 244 89 249 80 C258 111 254 140 242 153 C220 174 182 175 151 161 Z" />
          <path d="M186 180 C207 169 231 167 246 157 C245 171 236 186 227 191 C213 190 201 187 186 180 Z" />
          <path
            d="M155 140 C178 97 209 73 238 47"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      </svg>
    );
  }

  // 4. APP ICON DARK — Rounded Squircle Icon Badge
  if (variant === "symbol-dark") {
    const w = width ?? size ?? 44;
    const h = height ?? size ?? 44;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={w}
        height={h}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        {...a11yProps}
        {...props}
      >
        {!isDecorative && <title>{ariaLabel}</title>}
        <rect x="0" y="0" width="512" height="512" rx="96" fill="#063B2F" />
        <g transform="translate(127 134) scale(1.01)">
          <path
            d="M16 125 C16 65 65 14 125 14 C169 14 209 39 225 77 C209 76 188 86 169 106 C139 118 76 125 16 125 Z"
            fill="#E7C68F"
          />
          <path
            d="M47 129 C62 110 76 103 92 104 C108 80 125 69 141 72 C165 74 178 94 190 125 C138 140 86 144 47 129 Z"
            fill="#D3AE6D"
          />
          <path
            d="M13 138 C53 123 87 126 129 146 C175 168 210 185 254 166 L246 183 C211 200 175 183 123 160 C78 142 48 135 15 151 Z"
            fill="#A1BA87"
          />
          <path
            d="M16 157 C53 146 86 151 130 171 C181 194 215 201 250 184 L241 199 C210 216 170 200 120 180 C75 163 46 157 20 171 Z"
            fill="#85A476"
          />
          <path
            d="M20 177 C53 170 86 178 127 197 C169 218 208 225 241 204 C230 220 210 234 189 239 C163 237 136 222 116 211 C75 190 48 183 25 188 Z"
            fill="#A9C18B"
          />
          <path
            d="M29 195 C64 191 88 204 119 225 C132 233 145 238 160 243 C100 255 54 236 29 195 Z"
            fill="#A9C18B"
          />
          <path
            d="M142 151 C154 116 167 80 202 55 C219 43 238 33 252 18 C250 54 243 87 220 113 C198 140 169 148 142 151 Z"
            fill="#A9C18B"
          />
          <path
            d="M151 161 C176 140 202 136 222 111 C237 95 244 89 249 80 C258 111 254 140 242 153 C220 174 182 175 151 161 Z"
            fill="#A9C18B"
          />
          <path
            d="M186 180 C207 169 231 167 246 157 C245 171 236 186 227 191 C213 190 201 187 186 180 Z"
            fill="#85A476"
          />
          <path
            d="M155 140 C178 97 209 73 238 47"
            fill="none"
            stroke="#C5C77F"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M54 119 C72 108 79 107 94 108 C111 86 122 78 139 76 C154 77 164 88 174 101"
            fill="none"
            stroke="#063B2F"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      </svg>
    );
  }

  // 5. ROUND BADGE — Circular Heritage Seal
  if (variant === "badge") {
    const w = width ?? size ?? 72;
    const h = height ?? size ?? 72;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 560 560"
        width={w}
        height={h}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        {...a11yProps}
        {...props}
      >
        {!isDecorative && <title>{ariaLabel}</title>}
        <circle cx="280" cy="265" r="241" fill="none" stroke="#063B2F" strokeWidth="3" />
        <circle cx="280" cy="265" r="227" fill="none" stroke="#063B2F" strokeWidth="1" opacity="0.7" />
        <g transform="translate(155 92) scale(0.96)">
          <path
            d="M16 125 C16 65 65 14 125 14 C169 14 209 39 225 77 C209 76 188 86 169 106 C139 118 76 125 16 125 Z"
            fill="#F3CAA6"
          />
          <path
            d="M47 129 C62 110 76 103 92 104 C108 80 125 69 141 72 C165 74 178 94 190 125 C138 140 86 144 47 129 Z"
            fill="#EBB77A"
          />
          <path
            d="M13 138 C53 123 87 126 129 146 C175 168 210 185 254 166 L246 183 C211 200 175 183 123 160 C78 142 48 135 15 151 Z"
            fill="#527F58"
          />
          <path
            d="M16 157 C53 146 86 151 130 171 C181 194 215 201 250 184 L241 199 C210 216 170 200 120 180 C75 163 46 157 20 171 Z"
            fill="#064C36"
          />
          <path
            d="M20 177 C53 170 86 178 127 197 C169 218 208 225 241 204 C230 220 210 234 189 239 C163 237 136 222 116 211 C75 190 48 183 25 188 Z"
            fill="#063B2F"
          />
          <path
            d="M29 195 C64 191 88 204 119 225 C132 233 145 238 160 243 C100 255 54 236 29 195 Z"
            fill="#063B2F"
          />
          <path
            d="M142 151 C154 116 167 80 202 55 C219 43 238 33 252 18 C250 54 243 87 220 113 C198 140 169 148 142 151 Z"
            fill="#063B2F"
          />
          <path
            d="M151 161 C176 140 202 136 222 111 C237 95 244 89 249 80 C258 111 254 140 242 153 C220 174 182 175 151 161 Z"
            fill="#063B2F"
          />
          <path
            d="M186 180 C207 169 231 167 246 157 C245 171 236 186 227 191 C213 190 201 187 186 180 Z"
            fill="#064C36"
          />
          <path
            d="M155 140 C178 97 209 73 238 47"
            fill="none"
            stroke="#527959"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M54 119 C72 108 79 107 94 108 C111 86 122 78 139 76 C154 77 164 88 174 101"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
        <g fill="#063B2F">
          <path
            d="M240 -10Q164 -10 129.5 24.5Q95 59 95 145V526H19V536Q90 536 127 563Q166 590 179 659H189V536H329V526H189V108Q189 4 268 4Q295 4 329 16V6Q316 0 290.0 -5.0Q264 -10 240 -10Z"
            transform="translate(147.1 406) scale(0.06 -0.06)"
          />
          <path
            d="M292 -10Q180 -10 117.5 62Q55 134 55 264Q55 404 113 475Q171 546 277 546Q374 546 429.5 486Q485 426 485 307V283H152Q153 130 185.5 65Q218 0 295 0Q351 0 390 31Q429 62 439 123Q451 121 457 111Q463 101 463 90Q463 70 444 46.5Q425 23 387.5 6.5Q350 -10 292 -10ZM384 293Q384 424 359 480Q334 536 275 536Q214 536 185.5 480Q157 424 152 293Z"
            transform="translate(168.22 406) scale(0.06 -0.06)"
          />
          <path
            d="M215 -10Q139 -10 94.5 29.5Q50 69 50 138Q50 215 106.5 253Q163 291 278 295L361 298V373Q361 429 355 465Q349 501 329 518.5Q309 536 268 536Q210 536 193.5 500Q177 464 177 387Q135 387 113.5 401Q92 415 92 447Q92 483 116.5 504.5Q141 526 182 536Q223 546 272 546Q364 546 409.5 507Q455 468 455 373V74Q455 38 469 24Q483 10 517 10H520V0H369V105H367Q351 45 310.5 17.5Q270 -10 215 -10ZM235 4Q272 4 300.5 23Q329 42 345 74Q361 106 361 143V287L297 284Q212 280 179.5 245Q147 210 147 127Q147 4 235 4Z"
            transform="translate(200.32 406) scale(0.06 -0.06)"
          />
        </g>
      </svg>
    );
  }

  // 6. WORDMARK ONLY
  if (variant === "wordmark") {
    const w = width ?? (size ? Number(size) * 3.89 : 140);
    const h = height ?? (size ?? 36);
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 720 185"
        width={w}
        height={h}
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
        {...a11yProps}
        {...props}
      >
        {!isDecorative && <title>{ariaLabel}</title>}
        <g fill="#063B2F">
          <path
            d="M240 -10Q164 -10 129.5 24.5Q95 59 95 145V526H19V536Q90 536 127 563Q166 590 179 659H189V536H329V526H189V108Q189 4 268 4Q295 4 329 16V6Q316 0 290.0 -5.0Q264 -10 240 -10Z"
            transform="translate(138.5 102) scale(0.1 -0.1)"
          />
          <path
            d="M292 -10Q180 -10 117.5 62Q55 134 55 264Q55 404 113 475Q171 546 277 546Q374 546 429.5 486Q485 426 485 307V283H152Q153 130 185.5 65Q218 0 295 0Q351 0 390 31Q429 62 439 123Q451 121 457 111Q463 101 463 90Q463 70 444 46.5Q425 23 387.5 6.5Q350 -10 292 -10ZM384 293Q384 424 359 480Q334 536 275 536Q214 536 185.5 480Q157 424 152 293Z"
            transform="translate(173.7 102) scale(0.1 -0.1)"
          />
          <path
            d="M215 -10Q139 -10 94.5 29.5Q50 69 50 138Q50 215 106.5 253Q163 291 278 295L361 298V373Q361 429 355 465Q349 501 329 518.5Q309 536 268 536Q210 536 193.5 500Q177 464 177 387Q135 387 113.5 401Q92 415 92 447Q92 483 116.5 504.5Q141 526 182 536Q223 546 272 546Q364 546 409.5 507Q455 468 455 373V74Q455 38 469 24Q483 10 517 10H520V0H369V105H367Q351 45 310.5 17.5Q270 -10 215 -10ZM235 4Q272 4 300.5 23Q329 42 345 74Q361 106 361 143V287L297 284Q212 280 179.5 245Q147 210 147 127Q147 4 235 4Z"
            transform="translate(227.2 102) scale(0.1 -0.1)"
          />
          <path
            d="M27 0V10H40Q84 10 103 28Q122 46 122 87V526H31V536H122V586Q122 675 169 722.5Q216 770 311 770Q375 770 407 750.5Q439 731 439 700Q439 673 416 658.5Q393 644 357 644Q357 708 342.5 734Q328 760 292 760Q250 760 233 723.5Q216 687 216 595V536H357V526H216V92Q216 48 235 29Q254 10 298 10H336V0Z"
            transform="translate(283.5 102) scale(0.1 -0.1)"
          />
          <path
            d="M13 0V10H26Q70 10 89 28Q108 46 108 87V672Q108 714 89 732Q70 750 26 750H13V760H202V92Q202 48 221 29Q240 10 284 10H297V0Z"
            transform="translate(320.4 102) scale(0.1 -0.1)"
          />
          <path
            d="M287 -10Q179 -10 117 59Q55 128 55 269Q55 409 114.5 477.5Q174 546 290 546Q398 546 460 477.5Q522 409 522 269Q522 128 462.5 59Q403 -10 287 -10ZM289 0Q363 0 394 62Q425 124 425 269Q425 413 393.5 474.5Q362 536 288 536Q215 536 183.5 474.5Q152 413 152 269Q152 124 183.5 62Q215 0 289 0Z"
            transform="translate(351.4 102) scale(0.1 -0.1)"
          />
          <path
            d="M71 473Q63 502 49 514Q35 526 12 526H1V536H248V526H226Q192 526 178.5 517.5Q165 509 165 489Q165 471 174 441L242 193Q253 156 263 119Q273 82 283 44H285Q295 82 304.5 119.5Q314 157 324 196L412 533H476L589 191Q603 151 615.5 113Q628 75 641 35H643Q653 73 662 110.5Q671 148 681 185L745 435Q749 451 751.5 463.5Q754 476 754 486Q754 509 738 517.5Q722 526 682 526H647V536H861V526H835Q807 526 788.5 509Q770 492 759 448L644 0H565L408 475L284 0H209Z"
            transform="translate(409.1 102) scale(0.1 -0.1)"
          />
          <path
            d="M71 473Q63 502 49 514Q35 526 12 526H1V536H248V526H226Q192 526 178.5 517.5Q165 509 165 489Q165 471 174 441L242 193Q253 156 263 119Q273 82 283 44H285Q295 82 304.5 119.5Q314 157 324 196L412 533H476L589 191Q603 151 615.5 113Q628 75 641 35H643Q653 73 662 110.5Q671 148 681 185L745 435Q749 451 751.5 463.5Q754 476 754 486Q754 509 738 517.5Q722 526 682 526H647V536H861V526H835Q807 526 788.5 509Q770 492 759 448L644 0H565L408 475L284 0H209Z"
            transform="translate(495.3 102) scale(0.1 -0.1)"
          />
        </g>
      </svg>
    );
  }

  // 7. HORIZONTAL FULL COLOR / WHITE
  const isWhite = variant === "horizontal-white";
  const textColor = isWhite ? "#FFFFFF" : "#063B2F";
  const w = width ?? (size ? Number(size) * 3.12 : 180);
  const h = height ?? (size ?? 58);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1200 385"
      width={w}
      height={h}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      {...a11yProps}
      {...props}
    >
      {!isDecorative && <title>{ariaLabel}</title>}
      <g transform="translate(52 66) scale(1.01)">
        <path
          d="M16 125 C16 65 65 14 125 14 C169 14 209 39 225 77 C209 76 188 86 169 106 C139 118 76 125 16 125 Z"
          fill={isWhite ? "#FFFFFF" : "#F3CAA6"}
        />
        <path
          d="M47 129 C62 110 76 103 92 104 C108 80 125 69 141 72 C165 74 178 94 190 125 C138 140 86 144 47 129 Z"
          fill={isWhite ? "#FFFFFF" : "#EBB77A"}
        />
        <path
          d="M13 138 C53 123 87 126 129 146 C175 168 210 185 254 166 L246 183 C211 200 175 183 123 160 C78 142 48 135 15 151 Z"
          fill={isWhite ? "#FFFFFF" : "#527F58"}
        />
        <path
          d="M16 157 C53 146 86 151 130 171 C181 194 215 201 250 184 L241 199 C210 216 170 200 120 180 C75 163 46 157 20 171 Z"
          fill={isWhite ? "#FFFFFF" : "#064C36"}
        />
        <path
          d="M20 177 C53 170 86 178 127 197 C169 218 208 225 241 204 C230 220 210 234 189 239 C163 237 136 222 116 211 C75 190 48 183 25 188 Z"
          fill={isWhite ? "#FFFFFF" : "#063B2F"}
        />
        <path
          d="M29 195 C64 191 88 204 119 225 C132 233 145 238 160 243 C100 255 54 236 29 195 Z"
          fill={isWhite ? "#FFFFFF" : "#063B2F"}
        />
        <path
          d="M142 151 C154 116 167 80 202 55 C219 43 238 33 252 18 C250 54 243 87 220 113 C198 140 169 148 142 151 Z"
          fill={isWhite ? "#FFFFFF" : "#063B2F"}
        />
        <path
          d="M151 161 C176 140 202 136 222 111 C237 95 244 89 249 80 C258 111 254 140 242 153 C220 174 182 175 151 161 Z"
          fill={isWhite ? "#FFFFFF" : "#063B2F"}
        />
        <path
          d="M186 180 C207 169 231 167 246 157 C245 171 236 186 227 191 C213 190 201 187 186 180 Z"
          fill={isWhite ? "#FFFFFF" : "#064C36"}
        />
        <path
          d="M155 140 C178 97 209 73 238 47"
          fill="none"
          stroke={isWhite ? "#FFFFFF" : "#527959"}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path
          d="M54 119 C72 108 79 107 94 108 C111 86 122 78 139 76 C154 77 164 88 174 101"
          fill="none"
          stroke={isWhite ? "none" : "#FFFFFF"}
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      <g fill={textColor}>
        <path
          d="M240 -10Q164 -10 129.5 24.5Q95 59 95 145V526H19V536Q90 536 127 563Q166 590 179 659H189V536H329V526H189V108Q189 4 268 4Q295 4 329 16V6Q316 0 290.0 -5.0Q264 -10 240 -10Z"
          transform="translate(521.92 203) scale(0.112 -0.112)"
        />
        <path
          d="M292 -10Q180 -10 117.5 62Q55 134 55 264Q55 404 113 475Q171 546 277 546Q374 546 429.5 486Q485 426 485 307V283H152Q153 130 185.5 65Q218 0 295 0Q351 0 390 31Q429 62 439 123Q451 121 457 111Q463 101 463 90Q463 70 444 46.5Q425 23 387.5 6.5Q350 -10 292 -10ZM384 293Q384 424 359 480Q334 536 275 536Q214 536 185.5 480Q157 424 152 293Z"
          transform="translate(561.344 203) scale(0.112 -0.112)"
        />
        <path
          d="M215 -10Q139 -10 94.5 29.5Q50 69 50 138Q50 215 106.5 253Q163 291 278 295L361 298V373Q361 429 355 465Q349 501 329 518.5Q309 536 268 536Q210 536 193.5 500Q177 464 177 387Q135 387 113.5 401Q92 415 92 447Q92 483 116.5 504.5Q141 526 182 536Q223 546 272 546Q364 546 409.5 507Q455 468 455 373V74Q455 38 469 24Q483 10 517 10H520V0H369V105H367Q351 45 310.5 17.5Q270 -10 215 -10ZM235 4Q272 4 300.5 23Q329 42 345 74Q361 106 361 143V287L297 284Q212 280 179.5 245Q147 210 147 127Q147 4 235 4Z"
          transform="translate(621.264 203) scale(0.112 -0.112)"
        />
        <path
          d="M27 0V10H40Q84 10 103 28Q122 46 122 87V526H31V536H122V586Q122 675 169 722.5Q216 770 311 770Q375 770 407 750.5Q439 731 439 700Q439 673 416 658.5Q393 644 357 644Q357 708 342.5 734Q328 760 292 760Q250 760 233 723.5Q216 687 216 595V536H357V526H216V92Q216 48 235 29Q254 10 298 10H336V0Z"
          transform="translate(684.32 203) scale(0.112 -0.112)"
        />
        <path
          d="M13 0V10H26Q70 10 89 28Q108 46 108 87V672Q108 714 89 732Q70 750 26 750H13V760H202V92Q202 48 221 29Q240 10 284 10H297V0Z"
          transform="translate(725.648 203) scale(0.112 -0.112)"
        />
        <path
          d="M287 -10Q179 -10 117 59Q55 128 55 269Q55 409 114.5 477.5Q174 546 290 546Q398 546 460 477.5Q522 409 522 269Q522 128 462.5 59Q403 -10 287 -10ZM289 0Q363 0 394 62Q425 124 425 269Q425 413 393.5 474.5Q362 536 288 536Q215 536 183.5 474.5Q152 413 152 269Q152 124 183.5 62Q215 0 289 0Z"
          transform="translate(760.368 203) scale(0.112 -0.112)"
        />
        <path
          d="M71 473Q63 502 49 514Q35 526 12 526H1V536H248V526H226Q192 526 178.5 517.5Q165 509 165 489Q165 471 174 441L242 193Q253 156 263 119Q273 82 283 44H285Q295 82 304.5 119.5Q314 157 324 196L412 533H476L589 191Q603 151 615.5 113Q628 75 641 35H643Q653 73 662 110.5Q671 148 681 185L745 435Q749 451 751.5 463.5Q754 476 754 486Q754 509 738 517.5Q722 526 682 526H647V536H861V526H835Q807 526 788.5 509Q770 492 759 448L644 0H565L408 475L284 0H209Z"
          transform="translate(824.992 203) scale(0.112 -0.112)"
        />
        <path
          d="M71 473Q63 502 49 514Q35 526 12 526H1V536H248V526H226Q192 526 178.5 517.5Q165 509 165 489Q165 471 174 441L242 193Q253 156 263 119Q273 82 283 44H285Q295 82 304.5 119.5Q314 157 324 196L412 533H476L589 191Q603 151 615.5 113Q628 75 641 35H643Q653 73 662 110.5Q671 148 681 185L745 435Q749 451 751.5 463.5Q754 476 754 486Q754 509 738 517.5Q722 526 682 526H647V536H861V526H835Q807 526 788.5 509Q770 492 759 448L644 0H565L408 475L284 0H209Z"
          transform="translate(921.536 203) scale(0.112 -0.112)"
        />
      </g>
      <g fill={textColor}>
        <path
          d="M1346 0H1106V659H432V0H193V1462H432V864H1106V1462H1346Z"
          transform="translate(622.811 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M193 0V1462H432V0Z"
          transform="translate(647.834 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M825 0 401 1221H393Q410 949 410 711V0H193V1462H530L936 299H942L1360 1462H1698V0H1468V723Q1468 832 1473.5 1007Q1479 1182 1483 1219H1475L1036 0Z"
          transform="translate(662.158 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1100 0 954 406H395L252 0H0L547 1468H807L1354 0ZM891 612 754 1010Q739 1050 712.5 1136Q686 1222 676 1262Q649 1139 597 993L465 612Z"
          transform="translate(691.307 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M193 0V1462H432V205H1051V0Z"
          transform="translate(714.174 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1100 0 954 406H395L252 0H0L547 1468H807L1354 0ZM891 612 754 1010Q739 1050 712.5 1136Q686 1222 676 1262Q649 1139 597 993L465 612Z"
          transform="translate(734.182 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M606 795 952 1462H1212L725 567V0H485V559L0 1462H260Z"
          transform="translate(757.049 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1100 0 954 406H395L252 0H0L547 1468H807L1354 0ZM891 612 754 1010Q739 1050 712.5 1136Q686 1222 676 1262Q649 1139 597 993L465 612Z"
          transform="translate(778.252 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1411 0H1118L399 1165H391L396 1100Q410 914 410 760V0H193V1462H483L1200 303H1206Q1204 326 1198 470.5Q1192 615 1192 696V1462H1411Z"
          transform="translate(801.119 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M698 0H459V1257H29V1462H1128V1257H698Z"
          transform="translate(840.15 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1020 0H193V1462H1020V1260H432V862H983V662H432V203H1020Z"
          transform="translate(860.732 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1100 0 954 406H395L252 0H0L547 1468H807L1354 0ZM891 612 754 1010Q739 1050 712.5 1136Q686 1222 676 1262Q649 1139 597 993L465 612Z"
          transform="translate(881.127 278) scale(0.011719 -0.011719)"
        />
        <path
          d="M1036 397Q1036 202 895 91Q754 -20 506 -20Q258 -20 100 57V283Q200 236 312.5 209Q425 182 522 182Q664 182 731.5 236Q799 290 799 381Q799 463 737 520Q675 577 481 655Q281 736 199 840Q117 944 117 1090Q117 1273 247 1378Q377 1483 596 1483Q806 1483 1014 1391L938 1196Q743 1278 590 1278Q474 1278 414 1227.5Q354 1177 354 1094Q354 1037 378 996.5Q402 956 457 920Q512 884 655 825Q816 758 891 700Q966 642 1001 569Q1036 496 1036 397Z"
          transform="translate(903.994 278) scale(0.011719 -0.011719)"
        />
      </g>
    </svg>
  );
}
