// Run with the local dev server: node tests/browser/cart-totals.mjs
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { homedir } from 'node:os';
const cli = process.env.PWCLI || path.join(homedir(), '.codex/skills/playwright/scripts/playwright_cli.sh');
execFileSync(cli, ['open', process.env.BASE_URL || 'http://127.0.0.1:3367/cart'], {stdio:'inherit'});
const code = async (page) => {
 await page.route('**/api/cart/sync', r => r.fulfill({json:{}}));
 await page.route('**/api/cart/images?*', r => r.fulfill({json:{images:{'var-1':null},prices:{'var-1':10000}}}));
 await page.route('**/api/coupons/validate', r => r.fulfill({json:{valid:true,discountPaise:Math.round(r.request().postDataJSON().subtotalPaise / 10)}}));
 await page.evaluate(() => { localStorage.setItem('tea-house-cart',JSON.stringify([{variantId:1,name:'Total regression tea',slug:'total-test',grams:50,pricePaise:10000,quantity:1}])); document.cookie='hth_applied_coupon=TEST10; path=/'; });
 await page.reload();
 await page.getByText('Merchandise estimate',{exact:true}).waitFor();
 const essential = page.getByRole('button',{name:'Essential only',exact:true});
 if (await essential.isVisible()) await essential.click();
 await page.waitForTimeout(1200);
 const summary=page.getByRole('complementary',{name:'Order summary'});
 if (!(await summary.innerText()).includes('₹90')) throw new Error('Initial coupon total must be ₹90');
 await page.getByRole('button',{name:'Increase quantity of Total regression tea',exact:true}).click();
 await page.waitForTimeout(1200);

 const text=await summary.innerText();
 if (!text.includes('₹180')) throw new Error('Cart total mismatch: 2 × ₹100 with 10% coupon must show ₹180');
 await page.setViewportSize({width:390,height:844});
 await summary.scrollIntoViewIfNeeded();
 await page.screenshot({path:'output/playwright/cart-totals/mobile.png',fullPage:false});
 if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile cart overflows');
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'output/playwright/cart-totals/desktop.png',fullPage:false});
 // Recheck on a server price refresh without changing cart identity/quantity.
 await page.route('**/api/cart/images?*', r => r.fulfill({json:{images:{'var-1':null},prices:{'var-1':5000}}}));
 await page.evaluate(() => window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(1000);
 if (!(await summary.innerText()).includes('₹90')) throw new Error('Updated catalogue prices must refresh coupon savings');
 // Exercise the real checkout UI without creating an order or calling a gateway.
 await page.route('**/api/commerce/quote', async r => {
   const input = r.request().postDataJSON();
   if (input.items[0].quantity !== 2) throw new Error('Checkout lost cart quantity');
   const merchandise = input.coupon === 'TEST20' ? 8000 : 9000;
   await new Promise(resolve => setTimeout(resolve, 200));
   await r.fulfill({json:{id:'11111111-1111-4111-8111-111111111111',currency:'INR',totalMinor:merchandise,expires:Date.now()+60000,dutiesMode:'recipient',components:{merchandise},method:input.method}});
 });
 await page.getByRole('link',{name:'Continue to checkout',exact:false}).click();
 for (const [name,value] of Object.entries({name:'Regression Customer',phone:'9000000000',email:'regression@example.invalid',line1:'Synthetic test address',city:'Siliguri',state:'West Bengal',postcode:'734005'})) {
   await page.locator(`input[name="${name}"]`).fill(value);
 }
 await page.getByRole('button',{name:'Update Order Total →',exact:true}).waitFor();
 const aside = page.getByRole('complementary');
 if (!(await aside.innerText()).includes('₹90')) throw new Error('Cart and checkout merchandise must match');
 await page.locator('input[name="coupon"]').fill('TEST20');
 if (await page.getByRole('button',{name:'Update Order Total →',exact:true}).isVisible()) throw new Error('Old quote remains available after changing coupon');
 await page.getByRole('button',{name:'Update Order Total →',exact:true}).waitFor();
 if (!(await aside.innerText()).includes('₹80')) throw new Error('Checkout did not recalculate changed coupon');
};
execFileSync(cli,['run-code',code.toString()],{stdio:'inherit'});
