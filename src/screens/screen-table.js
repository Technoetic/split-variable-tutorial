import {HomeScreen} from './home-screen.js';
import {StoryScreen} from './story-screen.js';
import {SmellScreen} from './smell-screen.js';
import {StepsScreen,StepScreen} from './steps-screen.js';
import {ExceptionsScreen} from './exceptions-screen.js';
import {ParameterScreen} from './parameter-screen.js';
import {PracticeScreen} from './practice-screen.js';
import {CodeScreen} from './code-screen.js';
import {SummaryScreen,NotFoundScreen} from './summary-screen.js';

// Screen keys used by src/shared/route-table.js.
export const SCREENS=Object.freeze({home:HomeScreen,story:StoryScreen,smell:SmellScreen,steps:StepsScreen,step:StepScreen,exceptions:ExceptionsScreen,parameter:ParameterScreen,practice:PracticeScreen,code:CodeScreen,summary:SummaryScreen,notFound:NotFoundScreen});
