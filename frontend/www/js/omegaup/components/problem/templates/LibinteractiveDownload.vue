<template>
  <div class="libinteractive-download panel panel-default">
    <div class="panel-heading">{{ T.outputOnlyFiles }}</div>
    <div class="panel-body">
      <a :href="zipUrl" class="btn btn-primary">{{ T.downloadZip }}</a>
    </div>
  </div>
</template>

<script lang="ts">
import { Vue, Component, toNative } from 'vue-facing-decorator';
import T from '../../../lang';

@Component
class LibinteractiveDownload extends Vue {
  get zipUrl(): string {
    return '/problem/libinteractive/files.zip';
  }

  T = T;
}
export default toNative(LibinteractiveDownload);
</script>
