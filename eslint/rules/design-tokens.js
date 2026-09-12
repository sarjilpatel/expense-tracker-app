/**
 * design-tokens — the tokens are mandatory (W2-23).
 *
 * `TYPE_SCALE` was used 5 times against 626 raw `fontSize`s and `BORDER_RADIUS` 0 times, because
 * both were optional. This rule makes `constants/tokens.ts` and the theme the only way to express
 * a size, weight, radius, spacing step or colour inside `app/` and `components/`:
 *
 *   fontSize / fontWeight / lineHeight  -> spread a role: `...type.body`, or `weight.semibold`
 *   borderRadius                         -> `radius.sm | md | lg | full`
 *   padding* / margin* / gap             -> `space.xs .. xxl`, or any multiple of 4 above 32
 *   '#RRGGBB'                            -> a `theme.*` token (colour is derived, never written)
 *
 * The first three are auto-fixable (`eslint --fix`), and that fixer is the W2-23 codemod: it maps
 * a size to the nearest role, a radius to the nearest step and a spacing value onto the grid, and
 * adds the import. Colour is not — a hex literal has to become a theme token by hand, because
 * which token depends on what it sits on.
 *
 * The genuine exceptions — the lock screen's fixed dark surface, a shadow that has to be black —
 * carry an `eslint-disable-next-line local/design-tokens -- reason`, which is the point: they are
 * visible in review instead of being one more literal among 1,400.
 */
'use strict';

const TOKENS_MODULE = '@/constants/tokens';
const TYPE_KEYS     = new Set(['fontSize', 'fontWeight', 'lineHeight']);
const RADIUS_KEYS   = new Set(['borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']);
const SPACING_RE    = /^(padding|margin)(Top|Bottom|Left|Right|Horizontal|Vertical|Start|End|Block|Inline)?$|^(gap|rowGap|columnGap)$/;
const HEX_RE        = /^#[0-9a-f]{3,8}$/i;
const SPACE         = { 4: 'xs', 8: 'sm', 12: 'md', 16: 'lg', 24: 'xl', 32: 'xxl' };

// 0, the optical nudges 1 and 2, and the 4-point grid. `space` covers 4..32; above that a bare
// multiple of 4 is still on-grid.
const onGrid = (n) => n === 0 || Math.abs(n) <= 2 || Math.abs(n) % 4 === 0;

const keyName = (prop) => {
  if (prop.type !== 'Property' || prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'Literal') return String(prop.key.value);
  return null;
};

const literalValue = (node) => {
  if (!node) return undefined;
  if (node.type === 'Literal') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal') return -node.argument.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return undefined;
};

const numericWeight = (w) => {
  if (w === undefined) return undefined;
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const n = parseInt(w, 10);
  return Number.isNaN(n) ? undefined : n;
};

/** Which of the seven roles a raw size/weight pair is closest to (W2-21). */
function roleFor(size, weightNum, uppercase) {
  if (size >= 34) return 'display';
  if (size >= 21) return 'title';
  if (size >= 17) return 'heading';
  if (size >= 15) return weightNum >= 600 ? 'bodyStrong' : 'body';
  if (size <= 12 && uppercase) return 'overline';
  return 'label';
}

function radiusFor(value, siblings) {
  if (typeof value !== 'number') return null;
  const w = siblings.width, h = siblings.height;
  const isCircle = typeof w === 'number' && w === h && Math.abs(w / 2 - value) <= 1;
  if (isCircle || value >= 40) return 'full';
  if (value <= 9)  return 'sm';
  if (value <= 13) return 'md';
  return 'lg';
}

function spacingFor(value) {
  const abs = Math.abs(value);
  const snapped = Math.round(abs / 4) * 4 || 4;   // 1–2 never reach here; 3 → 4
  const sign = value < 0 ? '-' : '';
  return SPACE[snapped] ? `${sign}space.${SPACE[snapped]}` : `${sign}${snapped}`;
}

module.exports = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: { description: 'Sizes, weights, radii, spacing and colours come from the tokens, not literals.' },
    schema: [],
    messages: {
      type:    "Raw `{{key}}: {{value}}` — spread a type role instead (`...type.body`), or `weight.semibold` for a lone weight.",
      radius:  "Raw `{{key}}: {{value}}` — use `radius.sm | md | lg | full`.",
      spacing: "Off-grid `{{key}}: {{value}}` — use `space.xs .. xxl` (4-point grid).",
      colour:  "Hex colour `{{value}}` — colour comes from `useTheme()`; foregrounds are derived, never written.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    let program = null;
    let typeAlias = null;   // 'type' or 'text' — 'text' when the file already has a `type` variable

    const tokensImport = () => program.body.find(n =>
      n.type === 'ImportDeclaration' && n.source.value === TOKENS_MODULE && n.importKind !== 'type');

    const importedAs = (name) => {
      const decl = tokensImport();
      if (!decl) return null;
      const spec = decl.specifiers.find(s => s.type === 'ImportSpecifier' && s.imported.name === name);
      return spec ? spec.local.name : null;
    };

    // `type` is a popular variable name (`const [type, setType]`); alias the token to `text` when
    // any scope in the file declares one.
    const resolveTypeAlias = () => {
      if (typeAlias) return typeAlias;
      const already = importedAs('type');
      if (already) return (typeAlias = already);
      const clash = sourceCode.scopeManager.scopes.some(scope =>
        scope.set.has('type') && scope.set.get('type').defs.some(d => d.type !== 'ImportBinding'));
      return (typeAlias = clash ? 'text' : 'type');
    };

    /** A fix that guarantees `name` (optionally `as local`) is imported from the tokens module. */
    const ensureImport = (fixer, name, local = name) => {
      const decl = tokensImport();
      const specText = local === name ? name : `${name} as ${local}`;
      if (!decl) {
        const imports = program.body.filter(n => n.type === 'ImportDeclaration');
        const anchor  = imports[imports.length - 1];
        const line    = `import { ${specText} } from '${TOKENS_MODULE}';`;
        return anchor ? fixer.insertTextAfter(anchor, `\n${line}`) : fixer.insertTextBefore(program.body[0], `${line}\n`);
      }
      if (decl.specifiers.some(s => s.type === 'ImportSpecifier' && s.imported.name === name)) return null;
      const last = decl.specifiers[decl.specifiers.length - 1];
      return last ? fixer.insertTextAfter(last, `, ${specText}`) : fixer.replaceText(decl, `import { ${specText} } from '${TOKENS_MODULE}';`);
    };

    /** Remove a property together with the comma and whitespace that follow it. */
    const removeProperty = (fixer, prop) => {
      const after = sourceCode.getTokenAfter(prop);
      const text  = sourceCode.text;
      let end = prop.range[1];
      if (after && after.value === ',') {
        end = after.range[1];
        while (end < text.length && (text[end] === ' ' || text[end] === '\t')) end++;
      }
      return fixer.removeRange([prop.range[0], end]);
    };

    const siblingsOf = (prop) => {
      const out = {};
      const parent = prop.parent;
      if (parent && parent.type === 'ObjectExpression') {
        for (const p of parent.properties) {
          const k = keyName(p);
          if (k) out[k] = { value: literalValue(p.value), node: p };
        }
      }
      return out;
    };

    return {
      Program(node) { program = node; },

      Property(node) {
        const key = keyName(node);
        if (!key) return;
        const value = literalValue(node.value);
        if (value === undefined) return;
        const siblings = siblingsOf(node);

        if (key === 'fontSize') {
          const w    = numericWeight(siblings.fontWeight?.value);
          const role = roleFor(value, w, siblings.textTransform?.value === 'uppercase');
          context.report({
            node, messageId: 'type', data: { key, value: JSON.stringify(value) },
            fix(fixer) {
              const alias = resolveTypeAlias();
              const fixes = [fixer.replaceText(node, `...${alias}.${role}`)];
              for (const k of ['fontWeight', 'lineHeight', 'letterSpacing']) {
                if (siblings[k] && siblings[k].value !== undefined) fixes.push(removeProperty(fixer, siblings[k].node));
              }
              // `textTransform` is part of the overline role; `letterSpacing` rides with a role.
              if (role === 'overline' && siblings.textTransform) fixes.push(removeProperty(fixer, siblings.textTransform.node));
              const imp = ensureImport(fixer, 'type', alias);
              if (imp) fixes.push(imp);
              return fixes;
            },
          });
        } else if (key === 'fontWeight') {
          // A weight next to a literal size is folded into the role by the fontSize fix.
          if (siblings.fontSize && siblings.fontSize.value !== undefined) return;
          const n = numericWeight(value);
          const step = n === undefined ? null : n <= 400 ? 'regular' : n <= 500 ? 'medium' : n <= 600 ? 'semibold' : 'bold';
          context.report({
            node, messageId: 'type', data: { key, value: JSON.stringify(value) },
            fix: step ? (fixer) => {
              const fixes = [fixer.replaceText(node.value, `weight.${step}`)];
              const imp = ensureImport(fixer, 'weight');
              if (imp) fixes.push(imp);
              return fixes;
            } : null,
          });
        } else if (key === 'lineHeight') {
          if (siblings.fontSize && siblings.fontSize.value !== undefined) return;
          context.report({
            node, messageId: 'type', data: { key, value: JSON.stringify(value) },
            fix: (fixer) => removeProperty(fixer, node),
          });
        } else if (RADIUS_KEYS.has(key)) {
          const step = radiusFor(value, { width: siblings.width?.value, height: siblings.height?.value });
          context.report({
            node, messageId: 'radius', data: { key, value: JSON.stringify(value) },
            fix: step ? (fixer) => {
              const fixes = [fixer.replaceText(node.value, `radius.${step}`)];
              const imp = ensureImport(fixer, 'radius');
              if (imp) fixes.push(imp);
              return fixes;
            } : null,
          });
        } else if (SPACING_RE.test(key) && typeof value === 'number' && !onGrid(value)) {
          const replacement = spacingFor(value);
          context.report({
            node, messageId: 'spacing', data: { key, value: String(value) },
            fix(fixer) {
              const fixes = [fixer.replaceText(node.value, replacement)];
              if (replacement.includes('space.')) {
                const imp = ensureImport(fixer, 'space');
                if (imp) fixes.push(imp);
              }
              return fixes;
            },
          });
        }
      },

      Literal(node) {
        if (typeof node.value === 'string' && HEX_RE.test(node.value)) {
          context.report({ node, messageId: 'colour', data: { value: node.value } });
        }
      },
      TemplateLiteral(node) {
        if (node.expressions.length === 0 && HEX_RE.test(node.quasis[0].value.cooked ?? '')) {
          context.report({ node, messageId: 'colour', data: { value: node.quasis[0].value.cooked } });
        }
      },
    };
  },
};
