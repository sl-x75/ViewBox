// src/logic/css-utils.js

/**
 * Builds a Map from selector strings to their PostCSS rule objects for fast lookups.
 * @param {object} ast - The PostCSS root object (the stylesheet).
 * @returns {Map<string, object>}
 */
export function buildSelectorCache(ast) {
  const cache = new Map();
  ast.walkRules(rule => {
    // A single rule can have multiple selectors (e.g., '.a, .b {}')
    rule.selectors.forEach(s => cache.set(s, rule));
  });
  return cache;
}


/**
 * Scopes CSS rules by prepending a class to each selector.
 * It now intelligently ignores ID selectors (e.g., for patterns).
 * @param {string} cssContent - The CSS content to scope.
 * @param {string} scopeClass - The class to prepend.
 * @returns {string} The scoped CSS content.
 */
function scopeCssRules(cssContent, scopeClass) {
  // ... (the existing logic for splitting rules remains the same) ...
  const rules = [];
  // ...

  const scopedRules = rules.map(rule => {
    if (!rule.includes('{')) return rule;
    const [selectorsPart, ...declarationsParts] = rule.split('{');
    const declarations = declarationsParts.join('{');
    const selectors = selectorsPart.split(',').map(selector => {
      const trimmed = selector.trim();
      // --- THIS IS THE FIX ---
      // If the selector starts with '#' (an ID selector for a pattern),
      // or an @-rule, do not scope it with the class.
      if (!trimmed || trimmed.startsWith('@') || trimmed.startsWith('#')) {
        return trimmed;
      }
      // --- END OF FIX ---
      return `.${scopeClass} ${trimmed}`;
    });
    return `${selectors.join(', ')}{${declarations}`;
  });

  return scopedRules.join('\n');
}

/**
 * Inserts a rule into the correct category block in the AST.
 * @param {postcss.Root} ast - The PostCSS AST
 * @param {postcss.Rule} newRule - The rule to insert
 */
export function insertRuleInCategory(ast, newRule) {
  const category = getCategoryForSelector(newRule.selector);
  console.log('🔍 Inserting rule:', newRule.selector, '→ Category:', category);
  
  let targetNode = null;
  let lastRuleInNode = null;

  ast.walkComments(comment => {
    if (!targetNode) {
      const commentText = comment.text.trim();
      if (commentText.includes(category)) {
        console.log('✅ Found category comment:', commentText);
        targetNode = comment;
      }
    }
  });

  if (targetNode) {
    let nextNode = targetNode.next();
    while(nextNode && nextNode.type !== 'comment') {
      if (nextNode.type === 'rule') {
        lastRuleInNode = nextNode;
      }
      nextNode = nextNode.next();
    }

    if (lastRuleInNode) {
      lastRuleInNode.after(newRule);
    } else {
      targetNode.after(newRule);
    }
    newRule.raws.before = '\n';
  } else {
    console.warn(`❌ No category block found for: "${category}" (selector: ${newRule.selector})`);
    ast.append(newRule);
    newRule.raws.before = '\n';
  }
}

/**
 * Determines the correct category block for a given CSS selector.
 * @param {string} selector - The CSS selector string (may contain commas).
 * @returns {string} The name of the category block.
 */
export function getCategoryForSelector(selector) {
  const firstSelector = selector.split(',')[0].trim();
  const s = firstSelector;

  if (s.startsWith('g[ifc\\:guid')) {
    return 'IFCSPACE STYLES';
  }

  if (s.startsWith('#')) {
    if (s.includes('-marker')) return 'MARKERS STYLES';
    if (s.includes('-tag') || s.includes('-arrow') || s.includes('-point') || s.includes('dot') || s.includes('elevation')) return 'SYMBOL STYLES';
    return 'PATTERN STYLES';
  }

  if (s.startsWith('text.') || s.startsWith('tspan.')) {
    if (s.includes('.title') || s.includes('.header') || s.includes('.large') || s.includes('.regular') || s.includes('.small')) {
      return 'GENERIC DEFAULT TEXT TSPAN STYLES';
    }
    return 'TEXT TSPAN STYLES';
  }

  if (s.startsWith('.PredefinedType-')) {
    if (s.includes('-TEXT')) return 'PREDEFINED TYPES - TEXT STYLES';
    if (s.includes('-LINEWORK')) return 'PREDEFINED TYPES - LINEWORK STYLES';
    if (s.includes('-MATERIAL')) return 'PREDEFINED TYPES - MATERIALS STYLES';
    return 'PREDEFINED TYPES - ANNOTATIONS STYLES';
  }

  if (s.includes('.material-') || s.includes('.layer-material-')) {
    return 'MATERIAL & LAYER & SURFACE MATERIAL STYLES';
  }
  
  if (s.startsWith('.EPsetStatusStatus-')) {
    return 'EPSet STYLES';
  }

  return 'Default';
}


