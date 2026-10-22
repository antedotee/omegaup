<template>
  <div class="panel-heading badge-layer">
    <span class="ml-2">x</span>
    <button data-toggle-layout-sidebar @click="closeModal">y</button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  methods: {
    closeModal(): void {
      this.$emit('dismissed');
    },
  },
});
</script>

<style lang="scss" scoped>
.panel-heading {
  border-left: 1px solid;
}
</style>
