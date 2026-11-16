// Plain-text login code email. Temporary: MF-14 replaces it with the designed
// HTML + text template. The code is shown in two groups, e.g. "482 913" (03 › Email).
export function loginCodeMail(code, validMinutes) {
  const grouped = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: 'Your Metropolia Furniture login code',
    text: [
      `Your login code is ${grouped}.`,
      '',
      `It is valid for ${validMinutes} minutes and can be used once.`,
      'If you did not try to log in, you can ignore this email.',
      '',
      'Metropolia University of Applied Sciences · Metropolia Furniture',
    ].join('\n'),
  };
}
