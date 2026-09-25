<?php
/** @var array $product */
$cardId='product-'.$product['slug'];
$defaultColor=$product['colors'][$product['default_color']];
$defaultDir=$product['default_direction'];
$defaultSku=$defaultColor['sku_base'].'-'.$defaultDir;
?>
<article class="pcard" data-product-card data-family="<?= e($product['family']) ?>" id="<?= e($cardId) ?>">
  <div class="pcard__media">
    <div class="pcard__visual"><img class="pcard__image pcard__image--primary" src="<?= e(asset($product['image'])) ?>" alt="<?= e($product['name'].' '.$product['size']) ?>" loading="lazy"><?php if(!empty($product['image_alt'])): ?><img class="pcard__image pcard__image--alt" src="<?= e(asset($product['image_alt'])) ?>" alt="" loading="lazy" aria-hidden="true"><?php endif; ?></div>
    <a class="pcard__media-link" href="/catalog/<?= e($product['slug']) ?>/?color=<?= e($product['default_color']) ?>&dir=<?= e($defaultDir) ?>" aria-label="<?= e($product['name']) ?>"></a>
    <div class="pcard__topline"><span><?= e($product['eyebrow']) ?></span><span class="pcard__family"><?= $product['family']==='hs'?'Sliding':'Folding' ?></span></div>
    <div class="pcard__scheme-wrap"><?php require __DIR__.'/product-scheme.php'; ?></div>
    <?php if(!empty($product['image_alt'])): ?><button class="pcard__view" type="button" data-card-view><span>Закрыт</span><i></i><span>Открыт</span></button><?php endif; ?>
  </div>
  <div class="pcard__body">
    <a class="pcard__title" href="/catalog/<?= e($product['slug']) ?>/?color=<?= e($product['default_color']) ?>&dir=<?= e($defaultDir) ?>"><span><?= e($product['name']) ?> · <?= e($product['system']) ?></span><strong><?= e($product['title']) ?></strong></a>
    <div class="pcard__facts"><span><?= e($product['size']) ?></span><span><?= e($product['hardware']) ?></span></div>
    <div class="pcard__swatches" aria-label="Цвета"><?php foreach($product['colors'] as $code=>$color): ?><a class="pcard__swatch<?= $code===$product['default_color']?' is-active':'' ?>" href="/catalog/<?= e($product['slug']) ?>/?color=<?= e($code) ?>&dir=<?= e($defaultDir) ?>" title="<?= e($color['name'].' · '.$color['ral']) ?>" style="--swatch:<?= $code==='9016'?'#f2f1eb':($code==='7016'?'#353a3c':($code==='7024'?'#4c5051':'#111')) ?>"></a><?php endforeach; ?><span class="pcard__stock">В наличии</span></div>
    <div class="pcard__footer"><div class="pcard__price"><strong><?= e($product['price_label']) ?></strong><small>Срок · <?= e($product['lead_time']) ?></small></div><a class="pcard__arrow" href="/catalog/<?= e($product['slug']) ?>/?color=<?= e($product['default_color']) ?>&dir=<?= e($defaultDir) ?>">↗</a></div>
    <div class="pcard__sku">SKU <?= e($defaultSku) ?></div>
  </div>
</article>
