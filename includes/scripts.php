<?php $pageScripts = $pageScripts ?? []; ?>
<script defer src="<?= e(asset('/assets/js/menu.js')) ?>"></script>
<script defer src="<?= e(asset('/assets/js/accordions.js')) ?>"></script>
<script defer src="<?= e(asset('/assets/js/lead-form.js')) ?>"></script>
<?php foreach ($pageScripts as $script): ?>
<script defer src="<?= e(asset($script)) ?>"></script>
<?php endforeach; ?>
</body>
</html>
