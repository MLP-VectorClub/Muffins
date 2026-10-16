import { formatLogTimestamp } from './time.js';
export default (text: string) => console.log(formatLogTimestamp() + ' | ' + text);
