import moment from './moment-setup';
export default (text: string) => console.log(moment().format('YYYY-MM-DD HH:mm:ss.SSS')+' | ' + text);
