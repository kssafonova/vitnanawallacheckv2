<?php
/** @var array $product */
$scheme = $product['scheme'] ?? '';
?>
<svg class="pcard-scheme" viewBox="0 0 180 82" aria-hidden="true" focusable="false">
  <rect class="pcard-scheme__frame" x="1" y="1" width="178" height="80" rx="0"/>
  <?php if ($scheme === 'hs2'): ?>
    <line x1="90" y1="2" x2="90" y2="80"/>
    <path class="pcard-scheme__motion" d="M68 66H29m0 0 9-6m-9 6 9 6"/>
    <circle cx="66" cy="66" r="2.5"/>
  <?php elseif ($scheme === 'hs3'): ?>
    <line x1="60" y1="2" x2="60" y2="80"/><line x1="120" y1="2" x2="120" y2="80"/>
    <path class="pcard-scheme__motion" d="M107 66H73m0 0 8-6m-8 6 8 6M48 66H18m0 0 8-6m-8 6 8 6"/>
  <?php elseif ($scheme === 'hs4'): ?>
    <line x1="45" y1="2" x2="45" y2="80"/><line x1="90" y1="2" x2="90" y2="80"/><line x1="135" y1="2" x2="135" y2="80"/>
    <path class="pcard-scheme__motion" d="M80 66H51m0 0 7-5m-7 5 7 5M100 66h29m0 0-7-5m7 5-7 5"/>
  <?php elseif ($scheme === 'fs3'): ?>
    <line x1="60" y1="2" x2="60" y2="80"/><line x1="120" y1="2" x2="120" y2="80"/>
    <path class="pcard-scheme__motion" d="m154 64-22-14 22-14m-44 28 22-14-22-14"/>
  <?php elseif ($scheme === 'fs4'): ?>
    <line x1="45" y1="2" x2="45" y2="80"/><line x1="90" y1="2" x2="90" y2="80"/><line x1="135" y1="2" x2="135" y2="80"/>
    <path class="pcard-scheme__motion" d="m78 64-18-14 18-14m-36 28 18-14-18-14m96 28-18-14 18-14m-36 28 18-14-18-14"/>
  <?php endif; ?>
</svg>
