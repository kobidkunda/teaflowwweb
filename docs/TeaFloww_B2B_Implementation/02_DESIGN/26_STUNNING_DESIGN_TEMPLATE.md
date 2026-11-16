# High-Fidelity Design Template — Single-File Responsive Preview (HTML + CSS)

This file contains a **standalone concept layout** inside Markdown code fences. It demonstrates the premium TeaFloww visual language without needing backend credentials, actual product photography, JS frameworks or ad integrations. Copy the complete `html` block into a temporary `preview.html` to view; **do not deploy this static demo as the production lead page**. The real implementation follows `09_CODE_DESIGN_FOUNDATION.md`, `10_CODE_LANDING_PAGES.md` and `22_CODE_PREMIUM_INTERACTIONS.md`.

## Design direction

**“Origin / Commerce / Confidence.”** Editorial ivory canvas; grounded evergreen masthead; copper/gold accent; bold but clean typographic rhythm; mini product-format stage; contrasting light content surfaces; form panel as one focused action. All parts use the same color names, scale and radii. A full language switch, real photos, live stock, CRM integration, privacy policy and verified WhatsApp are intentionally absent from this visual-only prototype.

## Visual composition rules

- Hero text occupies left 50–55% of desktop; right 45% is a **conceptual graphic** for 25kg sack and retail packs. When ready, replace with genuine photographed materials.
- Main heading should be 8–11 words, max ~12–14ch line measure; 2–4 lines on mobile.
- Two prominent audience choices, followed by exactly three service-card options.
- Use uppercase mini-labels sparingly, restrained gold linework, clearly underlined text links, and almost no decorative icons.
- Alternate forest / ivory / almond surfaces. Never use random green shades beyond documented brand values.
- Maintain a single vertical spacing rhythm, preserve tap area and mobile fixed bar safe area.

## Fully self-contained design sample

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>TeaFloww — Tea Business Partner</title>
  <style>
    :root {
      --forest:#063B2F; --forest-2:#0A362B; --sage:#527F58;
      --ivory:#FFFBF3; --cream:#F6E8D7; --gold:#D8B36C;
      --copper:#8B5E3C; --ink:#0C2835; --mist:#C7D0D4;
      --radius:24px; --content:1200px;
      --shadow:0 22px 58px rgba(8,37,28,.09);
    }
    *,*::before,*::after{box-sizing:border-box}
    html{scroll-behavior:smooth}
    body{margin:0;background:var(--ivory);color:var(--ink);font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    a{color:inherit} button,input,select{font:inherit}
    .container{width:min(var(--content),calc(100% - 40px));margin-inline:auto}
    .masthead{background:var(--forest);color:var(--ivory);position:relative;overflow:hidden}
    .masthead:after{content:'';position:absolute;z-index:0;inset:0;pointer-events:none;background:radial-gradient(circle at 82% 29%,rgba(216,179,108,.16),transparent 35%)}
    header{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 0;border-bottom:1px solid rgba(255,255,255,.15)}
    .logo{font-weight:900;font-size:22px;letter-spacing:-.055em;text-decoration:none}.logo b{color:var(--gold)}
    nav{display:flex;gap:25px;align-items:center;font-size:14px;font-weight:650}
    nav a{text-decoration:none}nav a:hover{text-decoration:underline}
    .nav-pill{border:1px solid rgba(255,255,255,.4);padding:10px 16px;border-radius:100px}
    .hero{position:relative;z-index:1;display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(30px,5vw,80px);padding:78px 0 86px;align-items:center}
    .eyebrow{display:inline-flex;align-items:center;gap:12px;color:var(--gold);font-size:11px;font-weight:900;letter-spacing:.19em}
    .eyebrow:before{content:'';width:32px;border-top:1.5px solid var(--gold)}
    h1{font-size:clamp(43px,5.25vw,76px);line-height:1.02;font-weight:800;letter-spacing:-.065em;max-width:13ch;margin:20px 0 22px}
    .accent{color:var(--gold)}
    .hero p{max-width:56ch;color:var(--cream);font-size:clamp(16px,1.4vw,19px);line-height:1.76}
    .actions{display:flex;flex-wrap:wrap;gap:13px;margin:32px 0}
    .btn{min-height:52px;display:inline-flex;gap:12px;align-items:center;justify-content:center;background:var(--gold);color:var(--forest);font-weight:800;text-decoration:none;border-radius:100px;padding:12px 24px;border:1px solid transparent;transition:transform .15s ease}
    .btn:hover{transform:translateY(-2px)}.btn-ghost{background:transparent;color:var(--ivory);border-color:rgba(255,255,255,.35)}
    .persona{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:34px;font-size:14px;color:var(--cream)}
    .persona a{color:var(--ivory);text-underline-offset:4px}
    .showcase{position:relative;isolation:isolate;display:grid;align-items:end;grid-template-columns:1.1fr .7fr .7fr;gap:12px;min-height:475px;padding:38px 26px;border:1px solid rgba(246,232,215,.22);border-radius:34px;background:linear-gradient(150deg,#1d5b44,var(--forest-2) 65%,#05281f);box-shadow:0 32px 80px rgba(0,0,0,.22)}
    .showcase:before{content:'';position:absolute;z-index:-1;width:60%;aspect-ratio:1;top:6%;left:28%;border-radius:50%;background:radial-gradient(circle,rgba(216,179,108,.23),transparent 70%)}
    .pack{position:relative;display:flex;flex-direction:column;justify-content:center;align-items:center;min-width:0;min-height:210px;padding:16px 8px;color:var(--forest);text-align:center;border-radius:12px 12px 18px 18px;background:linear-gradient(135deg,#e9d2a4,#f8e9c8 52%,#d7b986);box-shadow:10px 22px 32px rgba(0,0,0,.2);transform:rotate(2deg)}
    .pack:nth-child(2){transform:rotate(-4deg);min-height:290px}.pack:nth-child(3){transform:rotate(4deg);min-height:250px}
    .pack:before{content:'';position:absolute;top:9px;left:12px;right:12px;border-top:3px solid rgba(6,59,47,.22)}
    .pack .leaf{font-size:31px;line-height:1}.pack strong{font-weight:900;line-height:1.1;letter-spacing:-.05em;font-size:clamp(13px,1.2vw,19px)}
    .pack small{font-size:10px;font-weight:800;letter-spacing:.1em;opacity:.8}.pack .size{font-size:12px;border-top:1px solid #9b805c;margin-top:16px;padding-top:7px;width:70%}
    .showcase-label{position:absolute;right:18px;top:18px;color:var(--cream);letter-spacing:.13em;font-weight:800;font-size:10px}
    .caption{position:absolute;bottom:12px;left:18px;color:var(--cream);font-size:10px;opacity:.85}
    .bar{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:-30px;position:relative;z-index:2}
    .bar-item{padding:19px 22px;background:#fffdf8;border-radius:16px;box-shadow:var(--shadow);border:1px solid rgba(6,59,47,.1)}
    .bar-item strong{color:var(--forest);display:block;font-size:14px}.bar-item span{font-size:12px;color:#50625e}
    .section{padding:92px 0}.section-heading{max-width:730px;margin-bottom:38px}.section-heading h2{font-size:clamp(34px,4vw,54px);line-height:1.12;letter-spacing:-.055em;margin:10px 0;color:var(--forest)}
    .kicker{font-size:11px;color:var(--copper);font-weight:850;letter-spacing:.16em}
    .section-heading p{font-size:16px;color:#4b5d5c}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
    .card{background:#fffefa;border:1px solid rgba(6,59,47,.13);border-radius:26px;padding:28px;min-height:304px;display:flex;flex-direction:column;box-shadow:0 18px 38px rgba(4,28,20,.04)}
    .card .n{color:var(--copper);font-size:12px;font-weight:800;letter-spacing:.16em}.card h3{font-size:25px;line-height:1.15;color:var(--forest);letter-spacing:-.04em;margin:38px 0 12px}
    .card p{font-size:14px;line-height:1.7;color:#54615b}.card a{margin-top:auto;padding-top:18px;font-weight:800;color:var(--forest);text-underline-offset:5px;font-size:14px}
    .steps-wrap{background:var(--cream)}.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}
    .steps li{border-top:1px solid rgba(139,94,60,.55);padding-top:22px}.steps b{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--ivory);color:var(--forest);border:1px solid rgba(139,94,60,.4)}
    .steps h3{font-size:16px;margin:22px 0 6px;color:var(--forest)}.steps p{font-size:13px;color:#52625b;line-height:1.7}
    .quote-wrap{background:var(--ivory)}.quote{background:var(--forest);color:var(--ivory);border-radius:34px;padding:clamp(28px,5vw,65px);display:grid;grid-template-columns:1fr 1.15fr;gap:48px;align-items:start}
    .quote h2{font-size:clamp(34px,3vw,52px);line-height:1.1;letter-spacing:-.05em;margin:17px 0}.quote p{color:var(--cream)}
    .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.field{display:grid;gap:6px}.field.wide{grid-column:1/-1}
    .field label{font-weight:700;font-size:13px}.field input,.field select{border:1px solid #b8c3b8;background:#fffdf8;border-radius:12px;padding:12px;width:100%;min-height:50px;color:var(--ink)}
    .quote small{color:var(--cream);line-height:1.55}.quote .btn{cursor:not-allowed;opacity:.55}
    footer{padding:36px 0;background:#042b22;color:var(--ivory);font-size:12px}
    a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
    @media(max-width:940px){.hero,.quote{grid-template-columns:1fr}.showcase{min-height:380px}.cards{grid-template-columns:repeat(2,1fr)}.steps{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:650px){.container{width:calc(100% - 32px)}nav a:not(.nav-pill){display:none}header{padding:18px 0}.hero{padding:43px 0 60px;gap:36px}h1{font-size:clamp(42px,11vw,60px)}.actions{flex-direction:column}.actions .btn{width:100%}.showcase{min-height:300px;padding:25px 13px 34px;border-radius:20px;gap:8px}.pack{min-height:150px;padding:12px 4px}.pack:nth-child(2){min-height:196px}.pack:nth-child(3){min-height:165px}.pack small{font-size:8px}.pack .leaf{font-size:22px}.bar{grid-template-columns:1fr;margin-top:-15px;gap:8px}.bar-item{padding:13px 16px}.section{padding:64px 0}.cards,.steps,.form-grid{grid-template-columns:1fr}.card{min-height:240px}.card h3{margin-top:22px}.quote{gap:22px;border-radius:22px}.field.wide{grid-column:auto}.persona{margin-top:22px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
  </style>
</head>
<body>
  <div class="masthead">
    <div class="container">
      <header>
        <a class="logo" href="#top" aria-label="TeaFloww homepage">tea<b>floww</b>.</a>
        <nav aria-label="Main navigation">
          <a href="#options">Supply options</a><a href="#how">How it works</a>
          <a href="#quote" class="nav-pill">Business Quote ↗</a>
        </nav>
      </header>
      <main id="top">
        <section class="hero" aria-labelledby="hero-h1">
          <div>
            <span class="eyebrow">SILIGURI • TEA BUSINESS PARTNERS</span>
            <h1 id="hero-h1">Build your tea <span class="accent">business.</span> We support the supply.</h1>
            <p>From 25kg bulk tea formats to 250g, 500g and 1kg pouches—and packaging, design and branding discussions. Start with your business requirements.</p>
            <div class="actions"><a class="btn" href="#quote">Build My Business Quote ↗</a><a class="btn btn-ghost" href="#options">Explore Supply Options</a></div>
            <div class="persona"><span>Choose your journey:</span><a href="#quote">I'm starting</a><a href="#quote">I already trade tea</a></div>
          </div>
          <div class="showcase" aria-label="Concept preview showing tea packing formats">
            <span class="showcase-label">PACK FORMATS</span>
            <div class="pack"><span class="leaf">✦</span><strong>TEA<br>SUPPLY</strong><small>CONCEPT</small><span class="size">25 KG</span></div>
            <div class="pack"><span class="leaf">✦</span><strong>RETAIL<br>TEA</strong><small>CONCEPT</small><span class="size">250 G</span></div>
            <div class="pack"><span class="leaf">✦</span><strong>OWN<br>BRAND</strong><small>CONCEPT</small><span class="size">1 KG</span></div>
            <span class="caption">Illustrative design concepts, not actual product photographs.</span>
          </div>
        </section>
      </main>
    </div>
  </div>
  <div class="container">
    <div class="bar" aria-label="Business supply overview">
      <div class="bar-item"><strong>Bulk tea formats</strong><span>Discuss 25kg sack requirements</span></div>
      <div class="bar-item"><strong>Retail pouch options</strong><span>250g • 500g • 1kg formats</span></div>
      <div class="bar-item"><strong>Your own brand</strong><span>Design and private-label support</span></div>
    </div>
  </div>
  <section id="options" class="section"><div class="container">
    <div class="section-heading"><span class="kicker">THREE WAYS TO PARTNER</span><h2>From the tea leaf to the retail shelf.</h2><p>Choose the supply format that fits your market. We confirm specifications, minimums and freight in a quotation.</p></div>
    <div class="cards">
      <article class="card"><span class="n">01 / WHOLESALE</span><h3>Bulk tea supply</h3><p>Discuss suitable grades and 25kg packing formats for your trade or redistribution plan.</p><a href="#quote">Request bulk options ↗</a></article>
      <article class="card"><span class="n">02 / READY PACKS</span><h3>Retail-ready pouches</h3><p>Explore 250g, 500g and 1kg product formats for shops, stockists and brand planning.</p><a href="#quote">Explore retail formats ↗</a></article>
      <article class="card"><span class="n">03 / BRAND</span><h3>Your own tea label</h3><p>Discuss artwork, pack design, private-label packaging and launch support for your market.</p><a href="#quote">Discuss branding ↗</a></article>
    </div>
  </div></section>
  <section id="how" class="section steps-wrap"><div class="container">
    <div class="section-heading"><span class="kicker">A CLEAR BUYING PATH</span><h2>From business idea to written quotation.</h2></div>
    <ol class="steps"><li><b>01</b><h3>Tell us your stage</h3><p>Starting out or already trading tea?</p></li><li><b>02</b><h3>Select a format</h3><p>Bulk, ready retail or private label.</p></li><li><b>03</b><h3>Share quantity</h3><p>Choose an estimated volume band.</p></li><li><b>04</b><h3>Confirm delivery</h3><p>Provide destination and pincode.</p></li><li><b>05</b><h3>Receive a quote</h3><p>Discuss commercial terms with the team.</p></li></ol>
  </div></section>
  <section id="quote" class="section quote-wrap"><div class="container">
    <div class="quote">
      <div><span class="eyebrow">BUSINESS ENQUIRY</span><h2>Let's discuss your first trade order.</h2><p>Tell us what you want to sell. We will confirm relevant supply options, minimums, taxes and freight before placing any order.</p><p><small>This is a static design preview only. The sample below does not submit or store any data.</small></p></div>
      <form class="form-grid" onsubmit="return false" aria-label="Visual-only sample enquiry form">
        <div class="field"><label for="stage">Business stage</label><select id="stage"><option>I'm starting</option><option>I already trade tea</option></select></div>
        <div class="field"><label for="format">Preferred format</label><select id="format"><option>Help me choose</option><option>25kg bulk tea</option><option>Retail pouches</option><option>My own tea brand</option></select></div>
        <div class="field"><label for="qty">Planned quantity</label><select id="qty"><option>Not sure yet</option><option>25–49kg</option><option>50–99kg</option><option>100kg or more</option></select></div>
        <div class="field"><label for="pin">Delivery pincode</label><input id="pin" inputmode="numeric" placeholder="6-digit pincode"></div>
        <div class="field"><label for="name">Name</label><input id="name" placeholder="Your name"></div>
        <div class="field"><label for="phone">Mobile</label><input id="phone" inputmode="tel" placeholder="Your mobile number"></div>
        <div class="field wide"><small>Production version must include proper contact consent, privacy notice, server-side validation, abuse prevention and CRM delivery.</small></div>
        <div class="field wide"><button class="btn" type="button" disabled>Preview Only — No Submission</button></div>
      </form>
    </div>
  </div></section>
  <footer><div class="container"><strong>TEAFLOWW • SILIGURI</strong><div>Premium tea supply and packaging discussions. All offers subject to written specification and quotation.</div></div></footer>
</body>
</html>
```

## Handoff notes

1. The template's illustrated packages are visibly marked **CONCEPT**. Replace with real approved tea product photos and screenshots from TeaFloww's actual design review process. Do not depict this concept image as an actual TeaFloww factory shot.
2. The prototype CTA links scroll within the page; the enquiry button is intentionally disabled. For production, use the typed components and secure lead/API module.
3. In production the persona switch should route to the two segment pages, not both anchor the same form; see `03_USER_FLOWS_AND_ROUTES.md`.
4. Materialize the main layout as shared components to prevent independent starter/trader style drift.
5. Validate actual performance and contrast. Aim for WCAG 2.2 AA; all text/contrast must be tested with the final palette and imagery.
