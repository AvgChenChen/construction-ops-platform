import 'dotenv/config';
import { configurationErrors,production } from '../src/lib/ops/config';
const errors=configurationErrors();if(process.argv.includes('--production')&&!production())errors.push('PRODUCTION_ENV_REQUIRED');if(errors.length){console.error(JSON.stringify({status:'invalid',errors}));process.exitCode=1;}else console.log(JSON.stringify({status:'configuration_valid'}));
