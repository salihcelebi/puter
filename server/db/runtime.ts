export const isServerlessRuntime = () => {
  const netlify = String(process.env.NETLIFY || '').toLowerCase() === 'true';
  const awsLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  const netlifyFunctions = Boolean(process.env.NETLIFY_IMAGES_CDN_DOMAIN || process.env.DEPLOY_URL || process.env.URL);

  return netlify || awsLambda || netlifyFunctions;
};

export const getWritableBaseDir = () => {
  if (isServerlessRuntime()) {
    return '/tmp';
  }

  return process.cwd();
};
