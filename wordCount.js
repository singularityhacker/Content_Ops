const fs = require('fs');
const path = require('path');
const glob = require('glob');
const readingTime = require('reading-time');
const execa = require('execa');
const { format, zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

const projectRoot = path.join(__dirname);

const logFilePath = path.join(projectRoot, 'logfile.json');

glob(
  'src/posts/**/*.md',
  { ignore: ['**/node_modules/**', '**/README.md'] },
  function (err, files) {
    if (err) {
      throw new Error(err.message);
    }

    // Guess timezone of user location
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = new Date();
    const localDate = utcToZonedTime(date, tz);
    const dateWithTimezone = format(localDate, 'yyyy-MM-dd HH:mm:ssXXX', {
      timeZone: tz,
    });

    files.forEach((file) => {
      const logFileContent = fs.readFileSync(`${logFilePath}`, 'utf8');
      const markdownFileContent = fs.readFileSync(`${file}`, 'utf8');

      const initialWordCount = readingTime(markdownFileContent).words;

      const parsedFile = JSON.parse(logFileContent);
      let fileInParts = file.split('/');
      const fileName = file
        .split('/')
        [fileInParts.length - 1].replace('.md', '');

      const existingFileName = parsedFile[fileName];

      if (!existingFileName) {
        console.info(
          `'${fileName}' seems to be a new file, adding to wordCount.js log file...`,
        );

        const newFileTimestamp = dateWithTimezone;

        const newContent = {
          ...parsedFile,
          [fileName]: {
            [newFileTimestamp]: {
              diff: initialWordCount,
              currentWords: initialWordCount,
            },
          },
        };

        fs.writeFileSync(logFilePath, JSON.stringify(newContent, null, 2));
      } else {
        const fileObjKeys = Object.keys(existingFileName);
        const latestTimestamp = fileObjKeys[fileObjKeys.length - 1];

        const currentWords = existingFileName[latestTimestamp].currentWords;

        const wordCountNew = readingTime(markdownFileContent).words;

        const diffTimestamp = dateWithTimezone;
        const diffInWords = wordCountNew - currentWords;

        if (diffInWords !== 0) {
          console.info(`Changes found in '${fileName}', creating diff...`);

          const updatingFileWithDiffContent = {
            ...parsedFile,
            [fileName]: {
              ...existingFileName,
              [diffTimestamp]: {
                diff: diffInWords,
                currentWords: wordCountNew,
              },
            },
          };

          fs.writeFileSync(
            logFilePath,
            JSON.stringify(updatingFileWithDiffContent, null, 2),
          );
        }
      }
    });

    /**
     * Lint-staged precommit hook doesn't stage file changes that happened through precommit hook itself
     * Therefore we need to manually run git add -A to ensure that logfile.json gets staged and committed,
     * otherwise it would be left behind as changed file in git
     */
    execa('git', ['add', '-A'], { cwd: __dirname });
  },
);
