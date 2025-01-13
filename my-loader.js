export async function resolve(specifier, context, defaultResolve) {
    if (!specifier.endsWith('.js')) {
      specifier += '.js';
    }
    return defaultResolve(specifier, context);
  }
  