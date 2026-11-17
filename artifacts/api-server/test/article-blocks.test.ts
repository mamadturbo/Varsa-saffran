import test from 'node:test';
import assert from 'node:assert/strict';
import { articleBlocks } from '../../varsa-shop/src/lib/article-blocks.ts';

test('article body never introduces another H1', () => {
  assert.deepEqual(articleBlocks('# Imported title\n## Section'), [
    { type: 'heading', level: 2, text: 'Imported title' },
    { type: 'heading', level: 2, text: 'Section' },
  ]);
});

test('imported article headings cannot skip levels', () => {
  assert.deepEqual(articleBlocks('###### Start\nparagraph\n###### Nested\n## Reset\n##### Next').filter(block => block.type === 'heading').map(block => block.level), [2, 3, 2, 3]);
});

test('valid nested article sections keep their levels through H6', () => {
  assert.deepEqual(articleBlocks('## Two\n### Three\n#### Four\n##### Five\n###### Six\n## Another').filter(block => block.type === 'heading').map(block => block.level), [2, 3, 4, 5, 6, 2]);
});

test('article content remains plain text with whitespace and blank lines normalized', () => {
  assert.deepEqual(articleBlocks(' \n  <h1>literal HTML</h1>  \n\n## <script>literal</script>\n #hashtag\n####### Too many'), [
    { type: 'paragraph', text: '<h1>literal HTML</h1>' },
    { type: 'heading', level: 2, text: '<script>literal</script>' },
    { type: 'paragraph', text: '#hashtag' },
    { type: 'paragraph', text: '####### Too many' },
  ]);
});

test('empty article produces no body blocks', () => {
  assert.deepEqual(articleBlocks(' \n\n'), []);
});
